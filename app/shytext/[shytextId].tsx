import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { ApproachableUserCard } from '../../components/ApproachableUserCard';
import { ChatRequestModal } from '../../components/ChatRequestModal';
import { ReportModal } from '../../components/ReportModal';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { ShyTextPost, INTENT_LABELS } from '../../types/shytext';
import { sendChatRequest } from '../../services/chat';
import { getLiveShyText, mapShyText } from '../../services/shytexts';
import { getVenue } from '../../services/venues';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function ShyTextDetailScreen() {
  const { shytextId } = useLocalSearchParams<{ shytextId: string }>();
  const theme = useTheme();
  const { profile } = useAuth();
  const [post, setPost] = useState<ShyTextPost | null>(null);
  const [venueName, setVenueName] = useState<string>();
  const [hello, setHello] = useState(false);
  const [report, setReport] = useState(false);

  useEffect(() => {
    if (!shytextId) return;
    getDoc(doc(db, 'shytexts', shytextId)).then(async (snap) => {
      if (!snap.exists()) return;
      const data = mapShyText(snap.id, snap.data());
      setPost(data);
      const venue = await getVenue(data.venueId);
      setVenueName(venue?.name);
    });
  }, [shytextId]);

  if (!post) {
    return (
      <Screen theme={theme}>
        <Text style={{ padding: 20, color: theme.muted }}>They’re no longer visible.</Text>
      </Screen>
    );
  }

  return (
    <Screen theme={theme}>
      <Pressable onPress={() => router.back()} style={{ padding: 20 }}>
        <Text style={{ color: theme.accent, fontWeight: '700' }}>← Back</Text>
      </Pressable>
      <ApproachableUserCard
        post={post}
        theme={theme}
        onSayHi={() => setHello(true)}
        onReport={() => setReport(true)}
      />
      <ChatRequestModal
        visible={hello}
        name={post.authorName}
        intentLabel={INTENT_LABELS[post.intent]}
        message={post.message}
        theme={theme}
        onClose={() => setHello(false)}
        onSend={async (intro) => {
          if (!profile) throw new Error('Sign in first.');
          const live = await getLiveShyText(post.id);
          if (!live) throw new Error('They are no longer visible.');
          await sendChatRequest({
            shytextId: post.id,
            shytextMessage: post.message,
            shytextIntent: post.intent,
            receiverId: post.authorId,
            venueId: post.venueId,
            venueName,
            senderName: profile.displayName,
            introMessage: intro,
          });
        }}
      />
      <ReportModal visible={report} onClose={() => setReport(false)} theme={theme} targetType="user" targetId={post.authorId} />
    </Screen>
  );
}
