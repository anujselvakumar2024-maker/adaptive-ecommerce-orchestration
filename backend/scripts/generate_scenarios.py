import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

import json
import math
import re
import pandas as pd

from search_engine import SearchEngine


engine = SearchEngine()

ground = pd.read_csv(
    "data/query_products.csv"
)

products = engine.products.copy()

ground["product_id"] = (
    ground["product_id"].astype(str)
)

products["product_id"] = (
    products["product_id"].astype(str)
)


# ======================================================
# CLEAN QUERY CHECK
# ======================================================

def clean_query(query):

    query = str(query).strip()

    if len(query) < 5 or len(query) > 100:
        return False

    if len(query.split()) < 2:
        return False

    letters = len(
        re.findall(
            r"[A-Za-z]",
            query
        )
    )

    if letters / len(query) < 0.65:
        return False

    return True


# ======================================================
# FIND BEST SEMANTIC PRODUCT
# ======================================================

def best_product(query, category):

    scores = engine._semantic_relevance(
        query
    )

    data = products.copy()
    data["score"] = scores

    data = data[
        data["category"] == category
    ]

    if len(data) == 0:
        return None

    return data.sort_values(
        "score",
        ascending=False
    ).iloc[0]


# ======================================================
# SPECIFIC SEARCH SCENARIOS
# ======================================================

specific = []

categories = [
    "phone",
    "laptop",
    "watch",
    "refrigerator"
]


def usable_title(title):
    title = str(title).strip()

    if len(title) < 15 or len(title) > 220:
        return False

    bad = [
        "case", "cover", "charger",
        "cable", "replacement",
        "screen protector", "adapter",
        "holder", "mount", "strap",
        "band", "filter", "drip pan",
        "tray"
    ]

    text = title.lower()

    return not any(
        x in text
        for x in bad
    )


def verify_specific(
    row,
    scenario_type
):

    # Use product title ONLY for backend validation.
    # Actual study participant types their own query.
    query = row["product_title"]

    result = engine.search(
        query=query,
        mode="orchestrated",
        category=row["category"],
        search_type="specific",
        k=5
    )

    ids = [
        str(x["product_id"])
        for x in result["results"]
    ]

    target = str(
        row["product_id"]
    )

    if scenario_type == "normal":

        # Target should be directly available
        return (
            not result[
                "orchestration_triggered"
            ]
            and target in ids
        )

    if scenario_type == "partner_recovery":

        # Stockout should trigger and
        # exact target should be recovered
        return (
            result[
                "orchestration_triggered"
            ]
            and target in ids
            and ids[0] == target
        )

    if scenario_type == "substitute_only":

        # Stockout triggers but exact
        # target cannot be recovered
        return (
            result[
                "orchestration_triggered"
            ]
            and target not in ids
        )

    return False


SPECIFIC_PER_CONDITION = 2

for category in categories:

    cat = products[
        products["category"] == category
    ].copy()

    cat = cat[
        cat["product_title"]
        .apply(usable_title)
    ]

    conditions = {
        "normal": cat[
            cat["internal_stock"] == 1
        ],

        "partner_recovery": cat[
            (cat["internal_stock"] == 0)
            &
            (cat["partner_available"] == 1)
        ],

        "substitute_only": cat[
            (cat["internal_stock"] == 0)
            &
            (cat["partner_available"] == 0)
        ]
    }

    for scenario_type, pool in conditions.items():

        added = 0

        # Stable ordering keeps generation reproducible
        pool = pool.sort_values("product_id")

        for _, row in pool.iterrows():

            if added >= SPECIFIC_PER_CONDITION:
                break

            if not verify_specific(
                row,
                scenario_type
            ):
                continue

            specific.append({
                "id":
                    f"{category}_{scenario_type}_{added + 1}",

                "search_type":
                    "specific",

                "category":
                    category,

                "scenario_type":
                    scenario_type,

                "target_product_id":
                    str(row["product_id"]),

                "target_product_title":
                    row["product_title"],

                "target_brand":
                    row["product_brand"],

                "internal_stock":
                    int(
                        row["internal_stock"]
                    ),

                "partner_available":
                    int(
                        row[
                            "partner_available"
                        ]
                    ),

                # Internal testing only.
                # Never show or pre-fill this for participants.
                "reference_query":
                    row["product_title"],

                "expected_orchestration":
                    scenario_type
                    != "normal"
            })

            added += 1

        if added < SPECIFIC_PER_CONDITION:
            print(
                "WARNING:",
                category,
                scenario_type,
                "only found",
                added,
                "valid scenarios"
            )

# ======================================================
# GENERAL SEARCH SCENARIOS
# ======================================================

general = []


def make_constraints(row):

    constraints = {}

    # Controlled price ceiling
    price = int(row["price"])

    ceiling = int(
        math.ceil(price / 10000)
        * 10000
    )

    constraints[
        "max_price"
    ] = ceiling

    # Use real product attributes
    attrs = engine._attributes(row)

    if "ram_gb" in attrs:
        constraints["ram_gb"] = (
            attrs["ram_gb"]
        )

    if "storage_gb" in attrs:
        constraints["storage_gb"] = (
            attrs["storage_gb"]
        )

    if "screen_inches" in attrs:
        constraints[
            "screen_inches"
        ] = attrs[
            "screen_inches"
        ]

    color = str(
        row["product_color"]
    ).strip().lower()

    useful_colors = [
        "black",
        "white",
        "silver",
        "gray",
        "grey",
        "blue",
        "red",
        "green",
        "gold",
        "pink",
        "purple",
        "brown"
    ]

    for c in useful_colors:

        if c in color:
            constraints["color"] = c
            break

    # If product has few structured
    # attributes, brand gives another
    # usable target constraint
    if (
        len(constraints) < 3
        and str(
            row["product_brand"]
        ).strip()
    ):
        constraints["brand"] = str(
            row["product_brand"]
        ).strip().lower()

    return constraints


def make_example_query(
    category,
    constraints
):

    parts = []

    if "brand" in constraints:
        parts.append(
            constraints["brand"]
        )

    if "color" in constraints:
        parts.append(
            constraints["color"]
        )

    parts.append(category)

    parts.append(
        "under "
        + str(
            constraints[
                "max_price"
            ]
        )
    )

    if "ram_gb" in constraints:
        parts.append(
            "with "
            + str(
                constraints[
                    "ram_gb"
                ]
            )
            + "gb ram"
        )

    if "storage_gb" in constraints:
        parts.append(
            "and "
            + str(
                constraints[
                    "storage_gb"
                ]
            )
            + "gb storage"
        )

    if "screen_inches" in constraints:
        parts.append(
            str(
                constraints[
                    "screen_inches"
                ]
            )
            + " inch"
        )

    return " ".join(parts)


for category in categories:

    candidates = products[
        (products["category"] == category)
        &
        (products["internal_stock"] == 1)
    ].copy()

    added = 0

    # Prefer products containing more
    # usable attributes
    scored = []

    for idx, row in candidates.iterrows():

        constraints = make_constraints(
            row
        )

        scored.append(
            (
                len(constraints),
                idx,
                constraints
            )
        )

    scored.sort(
        reverse=True
    )

    for _, idx, constraints in scored:

        if added >= 2:
            break

        row = candidates.loc[idx]

        # Need at least two meaningful
        # constraints besides category
        if len(constraints) < 2:
            continue

        example_query = make_example_query(
            category,
            constraints
        )

        # Check that optimized mode can
        # actually return useful products
        result = engine.search(
            query=example_query,
            mode="optimized",
            category=category,
            search_type="general",
            k=5
        )

        if not result["results"]:
            continue

        best_match = max(
            float(
                x["constraint_match"]
            )
            for x
            in result["results"]
        )

        # Avoid weak scenarios
        if best_match < 0.75:
            continue

        general.append({
            "id":
                f"{category}_general_{added + 1}",

            "search_type":
                "general",

            "category":
                category,

            # Website shows these
            # attributes as the user's
            # target before they type.
            "target_constraints":
                constraints,

            # Testing/reference only.
            # User should type their own
            # natural-language query.
            "reference_query":
                example_query,

            "reference_product_id":
                str(row["product_id"]),

            "reference_product_title":
                row["product_title"]
        })

        added += 1


# ======================================================
# SAVE
# ======================================================

scenarios = {
    "specific": specific,
    "general": general
}

with open(
    "data/scenarios.json",
    "w"
) as f:

    json.dump(
        scenarios,
        f,
        indent=2
    )


print("\nSPECIFIC SCENARIOS")
print("==================")

for s in specific:

    print(
        s["id"],
        "|",
        s["reference_query"]
    )


print("\nGENERAL SCENARIOS")
print("=================")

for s in general:

    print(
        s["id"],
        "|",
        s["target_constraints"]
    )


print("\nSaved:")
print(
    "data/scenarios.json"
)

print(
    "Specific:",
    len(specific)
)

print(
    "General:",
    len(general)
)
