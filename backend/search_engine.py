import os
import re
import pandas as pd
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA_PATH = os.path.join(BASE_DIR, "data", "products.csv")


class SearchEngine:

    def __init__(self, path=None):
        if path is None:
            path = DEFAULT_DATA_PATH
        elif not os.path.isabs(path):
            if not os.path.exists(path):
                alt = os.path.join(BASE_DIR, path)
                if os.path.exists(alt):
                    path = alt

        self.products = pd.read_csv(path)

        self.products["product_text"] = (
            self.products["product_text"]
            .fillna("")
            .astype(str)
        )

        self.products["product_brand"] = (
            self.products["product_brand"]
            .fillna("")
            .astype(str)
        )

        self.products["product_color"] = (
            self.products["product_color"]
            .fillna("")
            .astype(str)
        )

        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=30000,
            ngram_range=(1, 2)
        )

        self.matrix = self.vectorizer.fit_transform(
            self.products["product_text"]
        )

        # Known brands from our actual catalog
        brands = (
            self.products["product_brand"]
            .dropna()
            .astype(str)
            .unique()
        )

        self.brands = sorted(
            [
                x.lower().strip()
                for x in brands
                if len(x.strip()) >= 2
            ],
            key=len,
            reverse=True
        )


    # ==================================================
    # QUERY PARSING
    # ==================================================

    def _money(self, value):

        value = (
            str(value)
            .lower()
            .replace(",", "")
            .replace("₹", "")
            .strip()
        )

        if value.endswith("k"):
            return int(
                float(value[:-1]) * 1000
            )

        if value.endswith("lakh"):
            return int(
                float(value[:-4]) * 100000
            )

        if value.endswith("lac"):
            return int(
                float(value[:-3]) * 100000
            )

        try:
            return int(float(value))

        except:
            return None


    def parse_query(self, query):

        q = query.lower()

        constraints = {}

        number = (
            r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
            r"(?:\s*(?:k|lakh|lac))?"
        )
        
        currency = r"(?:₹|rs\.?|inr)"
        amount = rf"(?:{currency}\s*)?({number})"

        # ------------------------------------------
        # PRICE RANGE
        # ------------------------------------------

        match = re.search(
            rf"(?:between\s+)?{amount}"
            rf"\s*(?:-|to|and)\s*"
            rf"(?:{currency}\s*)?({number})",
            q
        )

        if match:
            constraints["min_price"] = (
                self._money(match.group(1))
            )

            constraints["max_price"] = (
                self._money(match.group(2))
            )

        else:

            match = re.search(
                rf"(?:under|below|less than|max(?:imum)?|upto|up to)"
                rf"\s*{amount}",
                q
            )

            if match:
                constraints["max_price"] = (
                    self._money(match.group(1))
                )

            match = re.search(
                rf"(?:above|over|more than|min(?:imum)?)"
                rf"\s*{amount}",
                q
            )

            if match:
                constraints["min_price"] = (
                    self._money(match.group(1))
                )

        # ------------------------------------------
        # RAM
        # ------------------------------------------

        match = re.search(
            r"(\d+)\s*gb\s*(?:ram|memory)",
            q
        )

        if match:
            constraints["ram_gb"] = int(
                match.group(1)
            )

        # ------------------------------------------
        # STORAGE
        # ------------------------------------------

        match = re.search(
            r"(\d+(?:\.\d+)?)\s*(tb|gb)"
            r"\s*(?:ssd|storage|rom)",
            q
        )

        if match:

            value = float(
                match.group(1)
            )

            unit = match.group(2)

            if unit == "tb":
                value *= 1024

            constraints["storage_gb"] = int(value)

        # ------------------------------------------
        # SCREEN SIZE
        # ------------------------------------------

        match = re.search(
            r"(\d+(?:\.\d+)?)\s*"
            r"(?:inch|inches|\")",
            q
        )

        if match:
            constraints["screen_inches"] = float(
                match.group(1)
            )

        # ------------------------------------------
        # COLOR
        # ------------------------------------------

        colors = [
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

        for color in colors:

            if re.search(
                rf"\b{color}\b",
                q
            ):
                constraints["color"] = color
                break

        # ------------------------------------------
        # BRAND
        # ------------------------------------------
        
        for brand in self.brands:
        
            if re.search(
                rf"(?<!\w){re.escape(brand)}(?!\w)",
                q
            ):
                constraints["brand"] = brand
                break

        # ------------------------------------------
        # DELIVERY
        # ------------------------------------------

        match = re.search(
            r"(?:within|in)\s*(\d+)\s*days?",
            q
        )

        if match:
            constraints["max_delivery_days"] = int(
                match.group(1)
            )

        return constraints


    # ==================================================
    # PRODUCT ATTRIBUTE EXTRACTION
    # ==================================================

    def _attributes(self, row):

        title = str(
            row["product_title"]
        ).lower()

        attributes = {}

        # RAM
        match = re.search(
            r"(\d+)\s*gb\s*"
            r"(?:ddr\d*|ram|memory)",
            title
        )

        if match:
            attributes["ram_gb"] = int(
                match.group(1)
            )

        # Storage
        match = re.search(
            r"(\d+(?:\.\d+)?)\s*(tb|gb)"
            r"\s*(?:ssd|storage|hdd|solid state)",
            title
        )

        if match:

            value = float(
                match.group(1)
            )

            if match.group(2) == "tb":
                value *= 1024

            attributes["storage_gb"] = int(value)
        else:
            # Standalone storage pattern common in phones: e.g., 64GB, 128GB, 256GB, 512GB
            match_phone_storage = re.search(
                r"\b(16|32|64|128|256|512)\s*(gb)\b",
                title
            )
            if match_phone_storage:
                val = int(match_phone_storage.group(1))
                if val != attributes.get("ram_gb"):
                    attributes["storage_gb"] = val

        # Screen
        match = re.search(
            r"(\d+(?:\.\d+)?)\s*"
            r"(?:inch|inches|\")",
            title
        )

        if match:
            attributes["screen_inches"] = float(
                match.group(1)
            )

        # Capacity for refrigerators (cu. ft.)
        match_cap = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:cu(?:\.|\s*ft|bic)|cubic\s*foot|cubic\s*feet)",
            title
        )
        if match_cap:
            attributes["capacity_cu_ft"] = float(match_cap.group(1))

        return attributes


    # ==================================================
    # CONSTRAINT MATCH
    # ==================================================

    def _constraint_score(
        self,
        row,
        constraints
    ):

        if not constraints:
            return 0

        product = self._attributes(row)

        scores = []

        # Use final price for partner products
        price = row.get(
            "final_price",
            row.get("price", None)
        )

        if pd.isna(price):
            price = row.get(
                "price",
                None
            )

        # Price maximum
        if "max_price" in constraints and constraints["max_price"] is not None:

            scores.append(
                1 if (
                    price is not None
                    and price <= constraints["max_price"]
                )
                else 0
            )

        # Price minimum
        if "min_price" in constraints and constraints["min_price"] is not None:

            scores.append(
                1 if (
                    price is not None
                    and price >= constraints["min_price"]
                )
                else 0
            )

        # RAM (handles both dynamic min_ram_gb and legacy ram_gb)
        if "min_ram_gb" in constraints and constraints["min_ram_gb"] is not None:
            min_ram = constraints["min_ram_gb"]
            ram = product.get("ram_gb")
            if ram is None:
                scores.append(0)
            elif ram >= min_ram:
                scores.append(1.0)
            elif ram >= min_ram * 0.5:
                scores.append(0.5)
            else:
                scores.append(0)
        elif "ram_gb" in constraints and constraints["ram_gb"] is not None:
            ram = product.get("ram_gb")
            if ram is None:
                scores.append(0)
            elif ram == constraints["ram_gb"]:
                scores.append(1)
            elif ram > constraints["ram_gb"]:
                scores.append(0.75)
            else:
                scores.append(0)

        # Storage (handles both dynamic min_storage_gb and legacy storage_gb)
        if "min_storage_gb" in constraints and constraints["min_storage_gb"] is not None:
            min_st = constraints["min_storage_gb"]
            storage = product.get("storage_gb")
            if storage is None:
                scores.append(0)
            elif storage >= min_st:
                scores.append(1.0)
            elif storage >= min_st * 0.5:
                scores.append(0.5)
            else:
                scores.append(0)
        elif "storage_gb" in constraints and constraints["storage_gb"] is not None:
            storage = product.get("storage_gb")
            if storage is None:
                scores.append(0)
            elif storage == constraints["storage_gb"]:
                scores.append(1)
            elif storage > constraints["storage_gb"]:
                scores.append(0.75)
            else:
                scores.append(0)

        # Screen size (handles min_screen_size/max_screen_size range, and legacy screen_inches)
        if ("min_screen_size" in constraints and constraints["min_screen_size"] is not None) or \
           ("max_screen_size" in constraints and constraints["max_screen_size"] is not None):
            screen = product.get("screen_inches")
            if screen is None:
                scores.append(0)
            else:
                min_s = float(constraints.get("min_screen_size") or 0)
                max_s = float(constraints.get("max_screen_size") or 999)
                if (min_s - 0.3) <= screen <= (max_s + 0.3):
                    scores.append(1.0)
                elif (min_s - 1.0) <= screen <= (max_s + 1.0):
                    scores.append(0.5)
                else:
                    scores.append(0)
        elif "screen_inches" in constraints and constraints["screen_inches"] is not None:
            screen = product.get("screen_inches")
            if screen is None:
                scores.append(0)
            elif abs(screen - constraints["screen_inches"]) <= 0.6:
                scores.append(1)
            else:
                scores.append(0)

        # Color (ignores unrestricted/null/any)
        if "color" in constraints and constraints["color"] is not None:
            color = str(constraints["color"]).strip().lower()
            if color and color not in ["any", "unrestricted", "all", "none"]:
                text = (
                    str(row.get("product_color", ""))
                    + " "
                    + str(row.get("product_title", ""))
                ).lower()
                scores.append(1 if color in text else 0)

        # Brand (supports string or list, ignores unrestricted/null/any)
        if "brand" in constraints and constraints["brand"] is not None:
            brand_val = constraints["brand"]
            product_brand = str(row.get("product_brand", "")).lower()
            product_title = str(row.get("product_title", "")).lower()
            if isinstance(brand_val, (list, tuple, set)):
                b_list = [str(b).strip().lower() for b in brand_val if str(b).strip().lower() not in ["", "any", "unrestricted", "all", "none"]]
                if b_list:
                    matched = any(b in product_brand or b in product_title for b in b_list)
                    scores.append(1 if matched else 0)
            else:
                brand_str = str(brand_val).strip().lower()
                if brand_str and brand_str not in ["any", "unrestricted", "all", "none"]:
                    scores.append(1 if (brand_str in product_brand or brand_str in product_title) else 0)

        # Capacity (for refrigerators)
        if "min_capacity_cu_ft" in constraints and constraints["min_capacity_cu_ft"] is not None:
            min_cap = float(constraints["min_capacity_cu_ft"])
            cap = product.get("capacity_cu_ft")
            if cap is None:
                scores.append(0)
            elif cap >= min_cap * 0.9:
                scores.append(1.0)
            elif cap >= min_cap * 0.6:
                scores.append(0.5)
            else:
                scores.append(0)

        if not scores:
            return 0

        return sum(scores) / len(scores)


    # ==================================================
    # RELEVANCE
    # ==================================================

    def _semantic_relevance(self, query):

        q = self.vectorizer.transform([query])

        return cosine_similarity(
            q,
            self.matrix
        )[0]


    def _optimized_relevance(
        self,
        query,
        constraints
    ):

        semantic = self._semantic_relevance(
            query
        )

        if not constraints:
            return semantic

        constraint_scores = np.array([
            self._constraint_score(
                row,
                constraints
            )
            for _, row in self.products.iterrows()
        ])

        # General search uses both query meaning
        # and structured attribute matching
        return (
            0.70 * semantic
            +
            0.30 * constraint_scores
        )

    def _hard_filter(
        self,
        candidates,
        constraints
    ):

        if not constraints:
            return candidates

        if "max_price" in constraints:
            candidates = candidates[
                candidates["price"]
                <= constraints["max_price"]
            ]

        if "min_price" in constraints:
            candidates = candidates[
                candidates["price"]
                >= constraints["min_price"]
            ]

        return candidates

    # ==================================================
    # MODE 0 — BASELINE
    # ==================================================

    def baseline(
        self,
        query,
        category=None,
        k=10,
        constraints=None
    ):

        scores = self._semantic_relevance(
            query
        )

        candidates = self.products.copy()
        candidates["score"] = scores

        if category:
            candidates = candidates[
                candidates["category"] == category
            ]

        candidates = candidates[
            candidates["internal_stock"] == 1
        ]

        candidates = candidates.sort_values(
            "score",
            ascending=False
        )

        result = candidates.head(k).copy()

        result["source"] = "internal"
        result["final_price"] = result["price"]

        return result


    # ==================================================
    # DIVERSITY RERANKER
    # ==================================================

    def _mmr(
        self,
        candidates,
        k=10,
        relevance_weight=0.90,
        brand_penalty=0.04
    ):

        if len(candidates) == 0:
            return candidates

        indices = candidates.index.tolist()

        # Compute candidate-to-candidate similarity ONCE
        similarity = cosine_similarity(
            self.matrix[indices]
        )

        position = {
            idx: pos
            for pos, idx in enumerate(indices)
        }

        selected = []
        remaining = indices.copy()

        while (
            remaining
            and len(selected) < k
        ):

            best = None
            best_score = -999

            for idx in remaining:

                relevance = candidates.loc[
                    idx,
                    "score"
                ]

                redundancy = 0

                if selected:

                    p = position[idx]

                    redundancy = max(
                        similarity[
                            p,
                            position[s]
                        ]
                        for s in selected
                    )

                brand = str(
                    candidates.loc[
                        idx,
                        "product_brand"
                    ]
                ).lower()

                brand_repeat = 0

                if brand:

                    for s in selected:

                        other = str(
                            candidates.loc[
                                s,
                                "product_brand"
                            ]
                        ).lower()

                        if brand == other:
                            brand_repeat = 1
                            break

                final_score = (
                    relevance_weight
                    * relevance
                    -
                    (1 - relevance_weight)
                    * redundancy
                    -
                    brand_penalty
                    * brand_repeat
                )

                if final_score > best_score:

                    best_score = final_score
                    best = idx

            selected.append(best)
            remaining.remove(best)

        return candidates.loc[
            selected
        ].copy()


    def _mmr_settings(
        self,
        search_type
    ):

        # Goal-directed / exact-product search:
        # strongly preserve relevance
        if search_type == "specific":

            return {
                "relevance_weight": 0.98,
                "brand_penalty": 0.01
            }

        # Exploratory/general search:
        # stronger diversity control
        return {
            "relevance_weight": 0.90,
            "brand_penalty": 0.04
        }

    # ==================================================
    # MODE 1 — OPTIMIZED
    # ==================================================

    def optimized(
        self,
        query,
        category=None,
        k=10,
        constraints=None,
        search_type="specific"
    ):

        scores = self._optimized_relevance(
            query,
            constraints
        )

        candidates = self.products.copy()
        candidates["score"] = scores

        if category:
            candidates = candidates[
                candidates["category"] == category
            ]

        candidates = self._hard_filter(
            candidates,
            constraints
        )

        candidates = candidates[
            candidates["internal_stock"] == 1
        ]

        candidates = candidates.nlargest(
            80,
            "score"
        )

        if len(candidates):

            best_score = (
                candidates["score"].max()
            )

            candidates = candidates[
                candidates["score"]
                >= best_score * 0.30
            ]

        settings = self._mmr_settings(
            search_type
        )

        result = self._mmr(
            candidates,
            k=k,
            **settings
        )

        result["source"] = "internal"
        result["final_price"] = result["price"]

        return result


    # ==================================================
    # MODE 2 — ADAPTIVE ORCHESTRATION
    # ==================================================

    def orchestrated(
        self,
        query,
        category=None,
        k=10,
        constraints=None,
        search_type="specific"
    ):

        scores = self._optimized_relevance(
            query,
            constraints
        )

        candidates = self.products.copy()
        candidates["score"] = scores

        if category:
            candidates = candidates[
                candidates["category"] == category
            ]

        candidates = self._hard_filter(
            candidates,
            constraints
        )

        candidates = candidates.nlargest(
            100,
            "score"
        ).copy()

        if len(candidates) == 0:

            trace = {
                "best_product_id": None,
                "best_product_title": None,
                "internal_available": False,
                "partner_exact_available": False,
                "partner_route_feasible": False,
                "selected_action": "no_result",
                "explanation": [
                    "No feasible candidates found."
                ]
            }

            return (
                pd.DataFrame(),
                False,
                trace
            )

        best_score = candidates["score"].max()

        candidates = candidates[
            candidates["score"]
            >= best_score * 0.30
        ].copy()

        settings = self._mmr_settings(
            search_type
        )

        best = candidates.iloc[0]

        # ------------------------------------------
        # BEST PRODUCT AVAILABLE INTERNALLY
        # ------------------------------------------

        if best["internal_stock"] == 1:

            internal = candidates[
                candidates["internal_stock"] == 1
            ].copy()

            result = self._mmr(
                internal,
                k=k,
                **settings
            )

            result["source"] = "internal"
            result["final_price"] = result["price"]

            trace = {
                "best_product_id":
                    str(best["product_id"]),

                "best_product_title":
                    str(best["product_title"]),

                "internal_available": True,

                "partner_exact_available":
                    bool(
                        best["partner_available"]
                        == 1
                    ),

                "partner_route_feasible": False,

                "selected_action":
                    "internal_fulfillment",

                "explanation": [
                    "Best-ranked product identified.",
                    "Product is available in internal inventory.",
                    "Adaptive orchestration was not required.",
                    "Selected internal fulfillment."
                ]
            }

            return (
                result,
                False,
                trace
            )


        # ------------------------------------------
        # STOCKOUT
        # ------------------------------------------

        orchestration_triggered = True

        internal = candidates[
            candidates["internal_stock"] == 1
        ].copy()

        partner_exact_available = bool(
            best["partner_available"] == 1
        )

        partner_ok = (
            partner_exact_available
        )


        # ------------------------------------------
        # PARTNER PRICE CONSTRAINTS
        # ------------------------------------------

        if (
            partner_ok
            and constraints
            and "max_price" in constraints
        ):

            if (
                best["partner_price"]
                > constraints["max_price"]
            ):
                partner_ok = False


        if (
            partner_ok
            and constraints
            and "min_price" in constraints
        ):

            if (
                best["partner_price"]
                < constraints["min_price"]
            ):
                partner_ok = False


        # ------------------------------------------
        # PARTNER DELIVERY CONSTRAINT
        # ------------------------------------------

        if (
            partner_ok
            and constraints
            and "max_delivery_days" in constraints
        ):

            if (
                best["partner_delivery_days"]
                >
                constraints[
                    "max_delivery_days"
                ]
            ):
                partner_ok = False


        # ------------------------------------------
        # EXACT PRODUCT RECOVERED VIA PARTNER
        # ------------------------------------------

        if partner_ok:

            recovered = best.copy()

            recovered["source"] = "partner"

            recovered["final_price"] = (
                best["partner_price"]
            )

            alternatives = self._mmr(
                internal,
                k=max(k - 1, 0),
                **settings
            )

            alternatives["source"] = "internal"

            alternatives["final_price"] = (
                alternatives["price"]
            )

            recovered_df = pd.DataFrame(
                [recovered]
            )

            result = pd.concat(
                [
                    recovered_df,
                    alternatives
                ]
            ).head(k)

            trace = {
                "best_product_id":
                    str(best["product_id"]),

                "best_product_title":
                    str(best["product_title"]),

                "internal_available": False,

                "partner_exact_available": True,

                "partner_route_feasible": True,

                "selected_action":
                    "partner_exact_recovery",

                "explanation": [
                    "Best-ranked product identified.",
                    "Product is unavailable in internal inventory.",
                    "Adaptive orchestration was triggered.",
                    "Exact product is available through a partner.",
                    "Partner constraints passed.",
                    "Selected exact-product partner recovery."
                ]
            }

            return (
                result,
                orchestration_triggered,
                trace
            )


        # ------------------------------------------
        # EXACT PARTNER ROUTE NOT POSSIBLE
        # -> SUBSTITUTE RECOVERY
        # ------------------------------------------

        internal_substitutes = internal.copy()

        internal_substitutes[
            "source"
        ] = "internal"

        internal_substitutes[
            "final_price"
        ] = internal_substitutes[
            "price"
        ]


        partner_substitutes = candidates[
            (
                candidates["internal_stock"]
                == 0
            )
            &
            (
                candidates["partner_available"]
                == 1
            )
        ].copy()


        # Do not re-add unavailable exact target
        partner_substitutes = (
            partner_substitutes[
                partner_substitutes.index
                != best.name
            ]
        )


        # ------------------------------------------
        # PARTNER-SUBSTITUTE CONSTRAINTS
        # ------------------------------------------

        if constraints:

            if "max_price" in constraints:

                partner_substitutes = (
                    partner_substitutes[
                        partner_substitutes[
                            "partner_price"
                        ]
                        <= constraints[
                            "max_price"
                        ]
                    ]
                )

            if "min_price" in constraints:

                partner_substitutes = (
                    partner_substitutes[
                        partner_substitutes[
                            "partner_price"
                        ]
                        >= constraints[
                            "min_price"
                        ]
                    ]
                )

            if (
                "max_delivery_days"
                in constraints
            ):

                partner_substitutes = (
                    partner_substitutes[
                        partner_substitutes[
                            "partner_delivery_days"
                        ]
                        <= constraints[
                            "max_delivery_days"
                        ]
                    ]
                )


        partner_substitutes[
            "source"
        ] = "partner"

        partner_substitutes[
            "final_price"
        ] = partner_substitutes[
            "partner_price"
        ]


        # ------------------------------------------
        # COMBINE SUBSTITUTE ROUTES
        # ------------------------------------------

        substitutes = pd.concat(
            [
                internal_substitutes,
                partner_substitutes
            ]
        )

        result = self._mmr(
            substitutes,
            k=k,
            **settings
        )


        partner_count = len(
            partner_substitutes
        )

        internal_count = len(
            internal_substitutes
        )


        trace = {
            "best_product_id":
                str(best["product_id"]),

            "best_product_title":
                str(best["product_title"]),

            "internal_available": False,

            "partner_exact_available":
                partner_exact_available,

            "partner_route_feasible":
                False,

            "internal_substitutes_considered":
                internal_count,

            "partner_substitutes_considered":
                partner_count,

            "selected_action":
                "substitute_recovery",

            "explanation": [
                "Best-ranked product identified.",
                "Product is unavailable in internal inventory.",
                "Adaptive orchestration was triggered.",
                (
                    "Exact partner route was unavailable "
                    "or failed user constraints."
                ),
                (
                    "Internal and partner substitute "
                    "routes were evaluated."
                ),
                "Selected substitute recovery."
            ]
        }

        return (
            result,
            orchestration_triggered,
            trace
        )


    # ==================================================
    # WEBSITE INTERFACE
    # ==================================================

    def search(
        self,
        query,
        mode,
        category=None,
        search_type="specific",
        k=10
    ):

        if search_type not in [
            "specific",
            "general"
        ]:
            raise ValueError(
                "search_type must be specific or general"
            )

        # Structured constraint reasoning is mainly
        # used for general exploratory searches.
        if search_type == "general":
            constraints = self.parse_query(
                query
            )
        else:
            constraints = {}

        if mode == "baseline":

            result = self.baseline(
                query,
                category,
                k
            )

            triggered = False

            decision_trace = {
                "selected_action":
                    "baseline_internal_retrieval",

                "explanation": [
                    "Products ranked using semantic relevance.",
                    "Only internal inventory was searched.",
                    "No adaptive orchestration was used."
                ]
            }


        elif mode == "optimized":

            result = self.optimized(
                query,
                category,
                k,
                constraints,
                search_type
            )

            triggered = False

            decision_trace = {
                "selected_action":
                    "optimized_internal_retrieval",

                "explanation": [
                    "Query processed using optimized relevance.",
                    "Relevance-diversity reranking was applied.",
                    "Only internal inventory was searched.",
                    "No adaptive stockout orchestration was used."
                ]
            }

        elif mode == "orchestrated":

            (
                result,
                triggered,
                decision_trace
            ) = self.orchestrated(
                query,
                category,
                k,
                constraints,
                search_type
            )

        else:
            raise ValueError(
                "mode must be baseline, "
                "optimized or orchestrated"
            )

        # Add constraint match percentage
        if len(result):

            result[
                "constraint_match"
            ] = result.apply(
                lambda row:
                self._constraint_score(
                    row,
                    constraints
                ),
                axis=1
            )

        columns = [
            "product_id",
            "product_title",
            "product_brand",
            "product_color",
            "category",
            "price",
            "source",
            "score",
            "final_price",
            "partner_delivery_days",
            "constraint_match"
        ]

        if "partner_delivery_days" in result.columns:
            result.loc[
                result["source"] != "partner",
                "partner_delivery_days"
            ] = None

        output = result[
            [
                c for c in columns
                if c in result.columns
            ]
        ]

        # Convert NaN values to JSON-safe None
        output = output.astype(object).where(
            pd.notnull(output),
            None
        )

        return {
            "query": query,
            "search_type": search_type,
            "mode": mode,
            "category": category,
            "parsed_constraints": constraints,
            "orchestration_triggered": triggered,
            "decision_trace": decision_trace,
            "results": output.to_dict(
                orient="records"
            )
        }
