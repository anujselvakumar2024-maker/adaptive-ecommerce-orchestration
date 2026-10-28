import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

import re
import time
import pandas as pd

from search_engine import SearchEngine


engine = SearchEngine()

ground = pd.read_csv("data/query_products.csv")
products = engine.products.copy()

ground["product_id"] = ground["product_id"].astype(str)
products["product_id"] = products["product_id"].astype(str)

catalog_ids = set(products["product_id"])


# =====================================================
# CLEAN QUERY
# =====================================================

def clean_query(query):
    query = str(query).strip()

    if len(query) < 5 or len(query) > 100:
        return False

    if len(query.split()) < 2:
        return False

    letters = len(re.findall(r"[A-Za-z]", query))

    if letters / max(len(query), 1) < 0.65:
        return False

    return True


# =====================================================
# FIND STRICT EXACT-TARGET CASES
#
# Requirements:
# 1. Real ESCI query
# 2. At least one Amazon-labelled Exact product exists
#    in the cleaned catalog
# 3. The top semantic product is itself Amazon-labelled Exact
#
# Counterfactual intervention:
# Force ONLY that exact target's internal_stock to 0 during
# evaluation. Preserve its existing deterministic partner
# availability, partner price and delivery fields.
# =====================================================

cases = []

for query_id, group in ground.groupby("query_id"):

    query = str(group["query"].iloc[0])
    category = str(group["category"].iloc[0])

    if not clean_query(query):
        continue

    exact_ids = set(
        group[
            group["esci_label"]
            .astype(str)
            .str.upper()
            == "E"
        ]["product_id"].astype(str)
    )

    exact_ids = exact_ids & catalog_ids

    if not exact_ids:
        continue

    scores = engine._semantic_relevance(query)

    candidates = products.copy()
    candidates["score"] = scores

    candidates = candidates[
        candidates["category"] == category
    ]

    if len(candidates) == 0:
        continue

    best = candidates.sort_values(
        "score",
        ascending=False
    ).iloc[0]

    target_id = str(best["product_id"])

    if target_id not in exact_ids:
        continue

    cases.append({
        "query_id": query_id,
        "query": query,
        "category": category,
        "target_product_id": target_id,
        "target_product_title": best["product_title"],
        "original_internal_stock": int(best["internal_stock"]),
        "partner_available": int(best["partner_available"]),
        "semantic_score": float(best["score"]),
        "exact_ids": exact_ids
    })


cases_df = pd.DataFrame(cases)

print("\nCounterfactual exact-target cases:")
print(len(cases_df))

if len(cases_df) == 0:
    print("No valid cases found.")
    raise SystemExit

print("\nCases by category:")
print(cases_df["category"].value_counts())

print("\nOriginal internal stock state:")
print(cases_df["original_internal_stock"].value_counts())

print("\nPreserved partner availability:")
print(cases_df["partner_available"].value_counts())


# =====================================================
# RESULT METRICS
# =====================================================

def evaluate_results(results, target_id, exact_ids):

    target_rank = None
    any_exact_rank = None
    target_source = None

    for rank, product in enumerate(results, start=1):

        product_id = str(product["product_id"])

        if product_id == target_id and target_rank is None:
            target_rank = rank
            target_source = product.get("source")

        if product_id in exact_ids and any_exact_rank is None:
            any_exact_rank = rank

    return {
        "target_recovered": int(target_rank is not None),
        "target_rank": target_rank,
        "target_mrr": (1 / target_rank if target_rank else 0),
        "any_exact_hit": int(any_exact_rank is not None),
        "any_exact_mrr": (1 / any_exact_rank if any_exact_rank else 0),
        "partner_recovery": int(
            target_rank is not None
            and target_source == "partner"
        )
    }


# =====================================================
# RUN COUNTERFACTUAL STOCKOUT ACROSS ALL 3 MODES
# =====================================================

rows = []

modes = [
    "baseline",
    "optimized",
    "orchestrated"
]

product_index = {
    str(row["product_id"]): idx
    for idx, row in engine.products.iterrows()
}


for _, case in cases_df.iterrows():

    target_id = str(case["target_product_id"])
    target_idx = product_index[target_id]

    original_stock = engine.products.at[
        target_idx,
        "internal_stock"
    ]

    # Counterfactual intervention:
    # force only the exact target out of internal stock.
    engine.products.at[
        target_idx,
        "internal_stock"
    ] = 0

    try:

        exact_ids = next(
            x["exact_ids"]
            for x in cases
            if str(x["query_id"]) == str(case["query_id"])
        )

        for mode in modes:

            start = time.perf_counter()

            response = engine.search(
                query=case["query"],
                mode=mode,
                category=case["category"],
                search_type="specific",
                k=5
            )

            latency_ms = (
                time.perf_counter() - start
            ) * 1000

            metrics = evaluate_results(
                response["results"],
                target_id,
                exact_ids
            )

            rows.append({
                "query_id": case["query_id"],
                "query": case["query"],
                "category": case["category"],
                "target_product_id": target_id,
                "target_product_title": case["target_product_title"],
                "original_internal_stock": int(
                    case["original_internal_stock"]
                ),
                "partner_available": int(
                    case["partner_available"]
                ),
                "mode": mode,
                "target_recovered": metrics["target_recovered"],
                "target_rank": metrics["target_rank"],
                "target_mrr": metrics["target_mrr"],
                "any_exact_hit": metrics["any_exact_hit"],
                "any_exact_mrr": metrics["any_exact_mrr"],
                "partner_recovery": metrics["partner_recovery"],
                "orchestration_triggered": int(
                    response["orchestration_triggered"]
                ),
                "latency_ms": latency_ms
            })

    finally:
        # Always restore the actual catalog state.
        engine.products.at[
            target_idx,
            "internal_stock"
        ] = original_stock


results = pd.DataFrame(rows)

results.to_csv(
    "data/counterfactual_stockout_results.csv",
    index=False
)


# =====================================================
# OVERALL SUMMARY
# =====================================================

summary = (
    results
    .groupby("mode")
    .agg(
        cases=("query_id", "count"),
        target_recovery_rate=("target_recovered", "mean"),
        target_mrr=("target_mrr", "mean"),
        any_exact_hit_at_5=("any_exact_hit", "mean"),
        any_exact_mrr=("any_exact_mrr", "mean"),
        partner_recovery_rate=("partner_recovery", "mean"),
        trigger_rate=("orchestration_triggered", "mean"),
        latency_ms=("latency_ms", "mean")
    )
    .reset_index()
)

for column in [
    "target_recovery_rate",
    "any_exact_hit_at_5",
    "partner_recovery_rate",
    "trigger_rate"
]:
    summary[column] *= 100


# =====================================================
# PARTNER-AVAILABLE CASES
# =====================================================

partner_cases = results[
    results["partner_available"] == 1
]

partner_summary = (
    partner_cases
    .groupby("mode")
    .agg(
        cases=("query_id", "count"),
        target_recovery_rate=("target_recovered", "mean"),
        target_mrr=("target_mrr", "mean"),
        partner_recovery_rate=("partner_recovery", "mean")
    )
    .reset_index()
)

for column in [
    "target_recovery_rate",
    "partner_recovery_rate"
]:
    partner_summary[column] *= 100


# =====================================================
# PARTNER-UNAVAILABLE CASES
# =====================================================

no_partner_cases = results[
    results["partner_available"] == 0
]

no_partner_summary = (
    no_partner_cases
    .groupby("mode")
    .agg(
        cases=("query_id", "count"),
        target_recovery_rate=("target_recovered", "mean"),
        any_exact_hit_at_5=("any_exact_hit", "mean"),
        any_exact_mrr=("any_exact_mrr", "mean")
    )
    .reset_index()
)

for column in [
    "target_recovery_rate",
    "any_exact_hit_at_5"
]:
    no_partner_summary[column] *= 100


# =====================================================
# BY CATEGORY
# =====================================================

by_category = (
    results
    .groupby(["category", "mode"])
    .agg(
        cases=("query_id", "count"),
        target_recovery_rate=("target_recovered", "mean"),
        target_mrr=("target_mrr", "mean"),
        any_exact_hit_at_5=("any_exact_hit", "mean"),
        any_exact_mrr=("any_exact_mrr", "mean"),
        trigger_rate=("orchestration_triggered", "mean")
    )
    .reset_index()
)

for column in [
    "target_recovery_rate",
    "any_exact_hit_at_5",
    "trigger_rate"
]:
    by_category[column] *= 100


# =====================================================
# SAVE
# =====================================================

summary.to_csv(
    "data/counterfactual_stockout_summary.csv",
    index=False
)

partner_summary.to_csv(
    "data/counterfactual_stockout_partner_summary.csv",
    index=False
)

no_partner_summary.to_csv(
    "data/counterfactual_stockout_no_partner_summary.csv",
    index=False
)

by_category.to_csv(
    "data/counterfactual_stockout_by_category.csv",
    index=False
)


# =====================================================
# PRINT
# =====================================================

pd.set_option("display.max_columns", None)
pd.set_option("display.width", 220)

print("\n" + "=" * 100)
print("COUNTERFACTUAL STOCKOUT STRESS TEST — ALL CASES")
print("=" * 100)
print(summary.round(3).to_string(index=False))

print("\n" + "=" * 100)
print("COUNTERFACTUAL STOCKOUTS — PARTNER AVAILABLE")
print("=" * 100)
print(partner_summary.round(3).to_string(index=False))

print("\n" + "=" * 100)
print("COUNTERFACTUAL STOCKOUTS — PARTNER UNAVAILABLE")
print("=" * 100)
print(no_partner_summary.round(3).to_string(index=False))

print("\n" + "=" * 100)
print("BY CATEGORY")
print("=" * 100)
print(by_category.round(3).to_string(index=False))

print("\nSaved:")
print("data/counterfactual_stockout_results.csv")
print("data/counterfactual_stockout_summary.csv")
print("data/counterfactual_stockout_partner_summary.csv")
print("data/counterfactual_stockout_no_partner_summary.csv")
print("data/counterfactual_stockout_by_category.csv")
