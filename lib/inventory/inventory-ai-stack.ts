'use client';

/**
 * The Inventory module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THE STOCK COLUMN IS NOT A STOCK BALANCE, AND THAT SHAPES EVERY TAB
 *
 * `inventory_item_master.opening_stock` is set when an item is created, INCREASED by a
 * direct purchase, and never decreased when stock is issued. Tracing every write to it in
 * the controllers confirms it: `inventory_item_direct_purchaseController` adds to it,
 * `requisitionApprovedController` only reads it, and nothing subtracts.
 *
 * So it systematically overstates what is on the shelf, by more the more has been issued —
 * and "which items are low on stock" and "what is out of stock", the two questions anybody
 * asks an inventory system, cannot be answered from this schema at all.
 *
 * Every published Inventory prompt therefore forbids the words in stock, out of stock, low
 * on stock, sufficient and running out, forbids recommending an order quantity, and
 * forbids subtracting the approved-for-issue figure from the stock figure and calling the
 * result a stock count. What the tabs report instead is `recorded_stock` under that name,
 * beside the reorder level and the quantity requisitions have approved.
 *
 * Both published prompts carry `requires_review` — the only module in this batch that
 * does. Somebody orders stock on this output, or decides not to.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const INVENTORY_MODULE_KEY = 'inventory';

/** The route the Inventory AI Stack reports itself as when it builds a report. */
export const INVENTORY_AI_STACK_ROUTE = '/modules/inventory/ai-stack';

export const INVENTORY_AI_STACK: AiStackModule = {
  key: INVENTORY_MODULE_KEY,
  menuSlug: 'inventory',
  label: 'Inventory',
  records: 'inventory items',
  record: 'inventory item',
  route: INVENTORY_AI_STACK_ROUTE,
  subjectEntityKey: 'inventory_item',

  copy: {
    centralRisk:
      'this estate keeps no running stock balance. The stock column is increased by a purchase and never decreased when stock is issued, so it overstates what is on the shelf and by more the more has gone out. Every published Inventory prompt forbids saying an item is in stock, out of stock, low or sufficient, forbids recommending an order quantity, and forbids subtracting the approved-for-issue figure from it and calling the result a count. The vendor record holds bank, PAN and registration details that no tool here can return.',
    policyNamePlaceholder: 'Inventory stock reporting policy',
    promptSystemDefault:
      'You summarise an inventory item master for a school store. Use only the items you are given. THIS SYSTEM KEEPS NO RUNNING STOCK BALANCE: the recorded stock figure is increased by a purchase and never decreased when stock is issued, so it overstates what is on the shelf. Never say an item is in stock, out of stock, low or sufficient, and never recommend an order quantity. `at_or_below_minimum` compares that same unreconciled figure to the recorded reorder level and means only that.',
    reportCanPrint: 'the items, categories and recorded figures come from the item master itself rather than from a model.',
    groundedOn: 'the item records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Inventory, so nothing here opens a case or raises a requisition. The tool agents on the Automations tab still read the item master, the requisitions and the purchase orders.',
    capabilityWorkflow:
      'No workflow is bound to Inventory. Approving a requisition or a purchase order stays a person’s act on the inventory screens — and it has to, because nothing here can tell them what is actually in the store.',
  },

  report: {
    defaultDataSource: 'inventory.items',
    // Exactly the arguments `inventory.items` accepts, from the tool's own schema.
    filters: [
      { key: 'category_id', label: 'Category id', kind: 'number', placeholder: 'all' },
      { key: 'sub_category_id', label: 'Sub-category id', kind: 'number', placeholder: 'all' },
      { key: 'item_type_id', label: 'Item type id', kind: 'number', placeholder: 'all' },
      { key: 'at_or_below_minimum_only', label: 'Only items at or below the recorded reorder level', kind: 'boolean', defaultValue: false, hint: 'Compares the recorded figure, which is not a shelf count.' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'item title or description' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'inventory_item_report',
    emptyNote:
      'No inventory items matched those filters, so no report was created. A category with nothing in it returns nothing rather than the whole item master.',
  },

  presets: [
    {
      name: 'Item master reader',
      description:
        'Reads items with the stock figure recorded against each and its reorder level. Changes nothing.',
      module: INVENTORY_MODULE_KEY,
      tools_allowed: ['inventory.items'],
      instructions:
        'Report `recorded_stock` under that name and never as "stock". This system does not decrease it when stock is issued, so it overstates the shelf: never say an item is in stock, out of stock or low, and never suggest how much to order. Say plainly that the figure is not a shelf count.',
      status: 'active',
    },
    {
      name: 'Requisition reader',
      description:
        'Reads requisitions with what was requested, what was approved and by whom. Changes nothing.',
      module: INVENTORY_MODULE_KEY,
      tools_allowed: ['inventory.requisitions'],
      instructions:
        'An approved requisition is a decision, not a handover — nothing records that the item was issued. Report the quantities and the approvals as recorded. The stock figure noted on a requisition form was typed by a person at the time and is not a reading of the shelf.',
      status: 'active',
    },
    {
      name: 'Purchase order reader',
      description:
        'Reads purchase order lines with the item, vendor name and amount. Changes nothing.',
      module: INVENTORY_MODULE_KEY,
      tools_allowed: ['inventory.purchase_orders'],
      instructions:
        'A purchase order is an order and not a delivery: never say anything arrived or was paid for. You are given the vendor’s name only — never ask for or refer to bank, PAN or registration details.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Items, requisitions and purchase orders are readable, but the Inventory module has no agent manifest of its own. Nor would one have much to conclude: with no running stock balance recorded anywhere, an agent could not tell whether anything needs ordering.',

  operations: {
    inventory_item_report: {
      key: 'inventory_item_report',
      label: 'Inventory item report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'item'],
    },
    inventory_summary: {
      key: 'inventory_summary',
      label: 'Inventory summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    inventory_analysis: {
      key: 'inventory_analysis',
      label: 'Inventory analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    inventory_agent_run: {
      key: 'inventory_agent_run',
      label: 'Inventory agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
