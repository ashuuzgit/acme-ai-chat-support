import { supabase } from "../db/supabase";

interface CreateTicketData {
  businessId: string;
  conversationId: string;
  customerName?: string;
  customerEmail?: string;
  query: string;
  priority: string;
}

export async function createTicket(data: CreateTicketData) {
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      business_id: data.businessId,
      conversation_id: data.conversationId,
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      query: data.query,
      priority: data.priority,
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;
  return ticket;
}
