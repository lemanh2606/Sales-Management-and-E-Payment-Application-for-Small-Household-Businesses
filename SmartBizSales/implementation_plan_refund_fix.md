# Implementation Plan - Fix Order Refund Modal Layout

I have completely refactored the layout of the "Select Paid Order" modal in `OrderRefundScreen.tsx` to fix the overflow and overlapping issues.

## User Review Required

> [!IMPORTANT]
> Verify the new Modal Layout:
>
> 1.  Open the "Select Paid Order" modal.
> 2.  The modal should now have a fixed height (80% of screen).
> 3.  The "Search" and "Filters" should be pinned to the top.
> 4.  The "Close" button should be pinned to the bottom.
> 5.  The **List of Orders** (in the middle) should be the ONLY thing that scrolls.
> 6.  Ensure no elements overlap.

## Proposed Changes

### Mobile App

#### [OrderRefundScreen.tsx](d:\Doan\Sales-Management-and-E-Payment-Application-for-Small-Household-Businesses\SmartBizSales\src\screens\pos\OrderRefundScreen.tsx)

- **Refactored Modal Layout**:
  - Changed `modalCard` to use `height: "80%"` and `flex: 1` for content management.
  - Separated the modal into **Header** (Title), **Body** (Filters + Scrollable List), and **Footer** (Close Button).
  - The **Body** uses `flex: 1` to occupy available space, and the List inside it also uses `flex: 1`.
  - Filters are now properly spaced at the top of the body.
  - The Close button is in a dedicated footer view with a top border, ensuring it never floats over content.

## Verification Plan

### Manual Verification

1.  Open app and navigate to "Refund" screen.
2.  Tap "Select Paid Order".
3.  Observe that the modal covers 80% of the screen height.
4.  Scroll the list of orders. Verify the search bar and close button stay visible and stationary.
5.  Verify filters can be swiped horizontally.
