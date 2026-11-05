---
"@adminium/add-on-shipping-dhl": patch
"@adminium/add-on-host": patch
---

DHL Shipping on a real shop: the demo carrier quotes in the shop's own currency (the order's value at dispatch, the basket's total at checkout) instead of US dollars. With the demo carrier switched off and no DHL account connected, the dispatch flow and the return label say "Your DHL account is not connected" and quote nothing, and the checkout draws no rates; before, the demo carrier answered anyway. While the demo is on, the dispatch flow says before quoting that nothing reaches DHL. A host that keeps its own packed weight passes it as `parcelWeightGrams` and the flow uses it as it is, so the two weights agree. The contents line names each line by its own quantity ("2 × Stoneware mug, 1 × Engraved walnut coasters") instead of "3 × Stoneware mug and 1 more".
