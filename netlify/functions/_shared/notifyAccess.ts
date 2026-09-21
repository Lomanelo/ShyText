import { getFirestoreDoc, queryCollection } from './firestoreAdmin';

function isLiveCheckIn(data: Record<string, unknown> | null, now = Date.now()) {
  if (!data) return false;
  const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : 0;
  return expiresAt > now;
}

async function haveRequestRelation(a: string, b: string): Promise<boolean> {
  const forward = await queryCollection('chatRequests', [
    { field: 'senderId', op: 'EQUAL', value: a },
    { field: 'receiverId', op: 'EQUAL', value: b },
  ], 1);
  if (forward.length > 0) return true;
  const reverse = await queryCollection('chatRequests', [
    { field: 'senderId', op: 'EQUAL', value: b },
    { field: 'receiverId', op: 'EQUAL', value: a },
  ], 1);
  return reverse.length > 0;
}

/**
 * Push is only allowed when the caller shares a conversation, a chat request,
 * or a live co-Shyne at the same venue with the recipient.
 */
export async function callerMayNotify(
  callerUid: string,
  recipientId: string,
  data: Record<string, string>
): Promise<boolean> {
  if (!callerUid || !recipientId || callerUid === recipientId) return false;

  const chatId = data.chatId?.trim();
  if (chatId) {
    const convo = await getFirestoreDoc(`conversations/${chatId}`);
    const ids = convo?.participantIds;
    if (
      Array.isArray(ids) &&
      ids.includes(callerUid) &&
      ids.includes(recipientId)
    ) {
      return true;
    }
  }

  const venueId = data.venueId?.trim();
  if (venueId) {
    const [mine, theirs] = await Promise.all([
      getFirestoreDoc(`checkins/${callerUid}`),
      getFirestoreDoc(`checkins/${recipientId}`),
    ]);
    if (
      mine?.venueId === venueId &&
      theirs?.venueId === venueId &&
      isLiveCheckIn(mine) &&
      isLiveCheckIn(theirs)
    ) {
      return true;
    }
  }

  // ShyText request / accept flows — any request doc between the pair.
  if (await haveRequestRelation(callerUid, recipientId)) {
    return true;
  }

  return false;
}
