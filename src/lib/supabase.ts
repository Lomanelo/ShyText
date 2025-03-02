import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});

export async function updateLocation(latitude: number, longitude: number) {
  const point = `POINT(${longitude} ${latitude})`;
  
  const { error } = await supabase
    .from('profiles')
    .update({
      last_location: point,
      last_active: new Date().toISOString(),
    })
    .eq('id', supabase.auth.user()?.id);

  if (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

export async function findNearbyUsers(latitude: number, longitude: number) {
  const { data, error } = await supabase
    .rpc('find_nearby_users', {
      user_location: `POINT(${longitude} ${latitude})`,
      distance_meters: 10
    });

  if (error) {
    console.error('Error finding nearby users:', error);
    throw error;
  }

  return data;
}

export async function startConversation(receiverId: string, message: string) {
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      initiator_id: supabase.auth.user()?.id,
      receiver_id: receiverId,
    })
    .select()
    .single();

  if (convError) {
    console.error('Error creating conversation:', convError);
    throw convError;
  }

  const { error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: supabase.auth.user()?.id,
      content: message,
    });

  if (msgError) {
    console.error('Error sending message:', msgError);
    throw msgError;
  }

  return conversation;
}

export async function respondToConversation(
  conversationId: string,
  accept: boolean
) {
  const { error } = await supabase
    .from('conversations')
    .update({
      status: accept ? 'accepted' : 'rejected',
    })
    .eq('id', conversationId);

  if (error) {
    console.error('Error responding to conversation:', error);
    throw error;
  }
}

export async function sendMessage(conversationId: string, content: string) {
  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: supabase.auth.user()?.id,
      content,
    });

  if (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}