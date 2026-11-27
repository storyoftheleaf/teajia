/**
 * Every tool the Teajia connector offers, grouped the way a tea moves through
 * the shop (docs/agents/TEA-SYSTEM-MAP.md, the ten steps), for the public
 * page at /mcp.
 *
 * worker/tests/mcp-page-catalog.test.ts holds this list to the worker's own:
 * a tool named here that the worker does not have fails, and so does a worker
 * tool this list leaves out. Add a new tool to the group where a person would
 * look for it.
 */

export interface ToolGroup {
  /** Step number on the tea system map, when the group is one of the ten. */
  step?: number;
  title: string;
  copy: string;
  tools: readonly string[];
}

/** The address every AI client is given. The site's own /mcp is this page. */
export const MCP_SERVER_URL = 'https://api.teajia.com/mcp';
export const MCP_PUBLIC_URL = 'https://api.teajia.com/mcp/public';

export const SHOP_TOOL_GROUPS: readonly ToolGroup[] = [
  {
    step: 1,
    title: 'Find it',
    copy: 'Bring a tea or sample in from a conversation, a photo, a pasted list or an invoice.',
    tools: [
      'curate_add_tea', 'curate_suggest_teas', 'curate_list_suggestions', 'curate_pick_suggestions',
      'intake_start', 'intake_add_source', 'intake_add_items', 'intake_analyze', 'intake_ask', 'intake_answer',
      'intake_get_draft', 'intake_update_item', 'intake_set_group_vendor', 'intake_finalize', 'create_tea',
      'curate_upload_attachment', 'curate_list_attachments', 'curate_add_photo', 'curate_tea_photos', 'curate_drive_photo',
    ],
  },
  {
    step: 2,
    title: 'The tea card and its supplier',
    copy: 'Read and correct a tea, see what it is missing, keep the supplier, their contacts and their quotes.',
    tools: [
      'curate_find', 'curate_get_tea', 'curate_update_tea', 'curate_whats_missing', 'curate_todo',
      'curate_correct', 'curate_history', 'curate_undo',
      'curate_get_vendor', 'curate_save_vendor', 'rename_supplier', 'set_supplier_photo',
      'upsert_vendor_contact', 'remove_vendor_contact', 'link_vendor', 'unlink_vendor', 'link_vendor_products',
      'curate_set_product_vendor', 'curate_get_quote', 'curate_list_quotes', 'curate_save_quote',
    ],
  },
  {
    step: 3,
    title: 'Taste and decide',
    copy: 'Record what a tea tastes like, track samples and sample sets, and write the shop’s own notes.',
    tools: [
      'set_tasting', 'set_curator_notes', 'list_samples', 'get_sample', 'set_sample_status',
      'list_sample_sets', 'curate_update_sample_set',
    ],
  },
  {
    step: 4,
    title: 'Buy and bring home',
    copy: 'Order from a supplier, record freight, and follow every leg of the journey.',
    tools: [
      'curate_order', 'curate_record_freight', 'list_purchases', 'get_purchase', 'set_purchase_logistics',
      'update_delivery_tracking', 'cancel_delivery_remainder',
      'list_logistics', 'create_logistics_shipment', 'update_logistics_shipment', 'dispatch_logistics_shipment',
      'receive_logistics_shipment', 'cancel_logistics_shipment', 'mark_logistics_arrival', 'estimate_logistics_volume',
      'record_logistics_tracking_update', 'resolve_logistics_reference',
      'list_logistics_addresses', 'create_logistics_address', 'update_logistics_address', 'archive_logistics_address',
      'create_logistics_service', 'update_logistics_service', 'archive_logistics_service',
    ],
  },
  {
    step: 5,
    title: 'Approve the arrival',
    copy: 'Say yes or no to what came, line by line.',
    tools: ['record_arrival', 'curate_list_arrivals', 'curate_approve_arrival', 'curate_reject_arrival'],
  },
  {
    step: 6,
    title: 'Add to Stock',
    copy: 'Make the Stock tea, count it, give its cost in its own currency, and price it.',
    tools: [
      'curate_promote_tea', 'curate_stock', 'add_stock', 'remove_stock', 'count_stock',
      'transfer_stock', 'list_transferable_accounts', 'update_tea_pricing', 'list_freight_rates', 'set_tea_freight_service', 'update_tea_catalog',
      'list_unstated_costs', 'set_cost_currency', 'set_low_stock_threshold', 'set_archive_status',
    ],
  },
  {
    step: 7,
    title: 'Make it public',
    copy: 'Choose the photos, check what the Tea Wisdom Base already holds for it, and show the tea in the shop.',
    tools: [
      'search_tea', 'get_tea', 'set_tea_image', 'add_tea_images', 'remove_tea_image', 'set_tea_visibility',
      'wisdom_records_for_tea', 'search_wisdom', 'get_wisdom_entry',
    ],
  },
  {
    step: 8,
    title: 'Offer it',
    copy: 'Gather teas into a collection to send, answer what people ask for, and turn a request into an order.',
    tools: [
      'list_collections', 'create_collection', 'add_tea_to_collection', 'remove_tea_from_collection',
      'publish_collection', 'unpublish_collection', 'share_collection_link', 'list_order_requests', 'set_order_request_status', 'convert_order_request',
    ],
  },
  {
    step: 9,
    title: 'Paid and sent',
    copy: 'Write the invoice, take the payment, send the parcel and say where it is.',
    tools: [
      'record_sale', 'draft_invoice', 'list_invoices', 'get_invoice', 'update_invoice', 'void_invoice', 'fulfill_invoice',
      'mark_invoice_paid', 'record_payment', 'confirm_payment', 'list_payment_claims',
      'list_orders_in_process', 'set_order_tracking', 'sales_summary',
    ],
  },
  {
    step: 10,
    title: 'After the cup',
    copy: 'Approve what buyers wrote and photographed, and see what is running low.',
    tools: [
      'list_tasting_excerpts', 'approve_tasting_excerpt', 'dismiss_tasting_excerpt', 'correct_tasting_excerpt',
      'set_tasting_excerpt_placement', 'list_offered_photographs', 'set_photograph_use', 'list_low_stock',
    ],
  },
  {
    title: 'Between shops',
    copy: 'Wholesale orders with another Teajia shop, from submitted to received.',
    tools: ['list_wholesale_orders', 'get_wholesale_order', 'move_wholesale_order'],
  },
  {
    title: 'People',
    copy: 'Find, add and tag the people the shop sells to.',
    tools: ['find_customer', 'get_customer', 'create_customer', 'update_customer', 'tag_customer', 'untag_customer'],
  },
  {
    title: 'Sessions and the Tea Table',
    copy: 'Open sessions, answer who is coming, and look after what is shown on the Tea Table.',
    tools: [
      'list_events', 'get_event', 'create_event', 'update_event', 'set_event_lifecycle',
      'list_event_rsvps', 'record_event_rsvp', 'approve_event_rsvp',
      'get_session_thanks', 'list_readings', 'set_session_reading',
      'hold_tea_table_piece', 'hide_tea_table_piece', 'set_tea_table_keep',
      'set_host_approval', 'stop_host', 'let_host_again',
    ],
  },
  {
    title: 'Places, teaware and contributors',
    copy: 'Where sessions are held, the teaware collection, and the people with a page in Read.',
    tools: ['list_venues', 'save_venue', 'list_teaware', 'list_contributors'],
  },
  {
    title: 'Writing',
    copy: 'Draft and publish articles, including one written from a session.',
    tools: ['list_articles', 'get_article', 'create_article_draft', 'update_article_draft', 'draft_article_from_event', 'set_article_published'],
  },
  {
    title: 'The shop itself',
    copy: 'What is waiting, what agents changed and the way back, the site\u2019s problems, settings and exchange rates.',
    tools: [
      'whats_waiting', 'list_agent_changes', 'undo_agent_change', 'list_site_problems', 'resolve_site_problem',
      'get_account_context', 'update_account_settings', 'update_exchange_rate',
    ],
  },
  {
    title: 'Hosts, reports and the Tea Table',
    copy: 'For the platform owner: how widely a host may open their tables, reports to read and resolve, article offers from hosts, and what is on the Tea Table.',
    tools: ['set_host_reach', 'list_reports', 'resolve_report', 'review_article_offer', 'list_tea_table'],
  },
];

/** Tools a host's own key reaches: their tables, guests and circles, nothing of the shop. */
export const HOST_TOOL_GROUP: ToolGroup = {
  title: 'A host’s own table',
  copy: 'With a host’s own key, their assistant reaches their tables, guests, notes and circles, and nothing of the shop.',
  tools: [
    'host_table', 'list_my_tables', 'get_table_guests', 'answer_guest', 'add_table_tea', 'set_guest_note',
    'get_guest_notes', 'release_guest_seat', 'same_table_again', 'set_session_tasting',
    'make_circle', 'put_table_in_circle', 'list_my_circles', 'list_my_favourites',
    'change_my_table', 'mark_who_came', 'get_guest_thanks_link', 'review_guest_book', 'set_table_way',
    'set_your_table', 'ask_guest_back', 'offer_article',
  ],
};

/** Tools any signed-in person may use on their own seat and pieces. */
export const PERSONAL_TOOL_GROUP: ToolGroup = {
  title: 'Anyone signed in',
  copy: 'Read your own orders, Tea Chest and journal, give back a seat, keep a favourite, put a recap on the Tea Table or take a tasting off it, report a problem.',
  tools: ['list_my_orders', 'list_my_tea_chest', 'list_my_journal', 'release_my_seat', 'set_my_favourite', 'set_my_recap_on_tea_table', 'take_my_tasting_off_tea_table', 'report', 'set_my_payment_details'],
};

/** The read-only connector for shoppers, at MCP_PUBLIC_URL. */
export const PUBLIC_TOOLS: readonly string[] = ['search_tea', 'get_tea', 'browse_catalog', 'prepare_order', 'search_wisdom', 'get_wisdom_entry'];

export function allCatalogTools(): string[] {
  return [...SHOP_TOOL_GROUPS, HOST_TOOL_GROUP, PERSONAL_TOOL_GROUP].flatMap((group) => group.tools);
}
