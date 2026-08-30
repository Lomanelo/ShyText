import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { Screen } from '../../components/Screen';
import { ShyTextCard } from '../../components/ShyTextCard';
import { ChatRequestModal } from '../../components/ChatRequestModal';
import { ReportModal } from '../../components/ReportModal';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ShyTextPost } from '../../types/shytext';
import { sendChatRequest } from '../../services/chat';
import { deleteOwnShyText } from '../../services/shytexts';
import { getVenue } from '../../services/venues';

export default function ShyTextDetailScreen() {
  const { shytextId } = useLocalSearchParams<{ shytextId: string }>();
  const theme = useTheme();
  const { user, profile } = useAuth();
  const [post, setPost] = useState<ShyTextPost | null>(null);
  const [venueName, setVenueName] = useState<string>();
  const [hello, setHello] = useState(false);
  const [report, setReport] = useState(false);

  useEffect(() => {
    if (!shytextId) return;
    getDoc(doc(db, 'shytexts', shytextId)).then(async (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as ShyTextPost;
      setPost(data);
      const venue = await getVenue(data.venueId);
      setVenueName(venue?.name);
    });
  }, [shytextId]);

  if (!post) {
    return (
      <Screen theme={theme}>
        <Text style={{ padding: 20, color: theme.muted }}>This ShyText is gone.</Text>
      </Screen>
    );
  }

  return (
    <Screen theme={theme}>
      <Pressable onPress={() => router.back()} style={{ padding: 20 }}>
        <Text style={{ color: theme.accent, fontWeight: '700' }}>← Back</Text>
      </Pressable>
      <ShyTextCard
        post={post}
        theme={theme}
        isOwn={post.authorId === user?.uid}
        onHello={() => setHello(true)}
        onReport={() => setReport(true)}
        onDelete={async () => {
          await deleteOwnShyText(post.id);
          router.back();
        }}
      />
      <ChatRequestModal
        visible={hello}
        name={post.authorName}
        theme={theme}
        onClose={() => setHello(false)}
        onSend={async (intro) => {
          if (!profile) throw new Error('Sign in first.');
          await sendChatRequest({
            shytextId: post.id,
            shytextMessage: post.message,
            receiverId: post.authorId,
            venueId: post.venueId,
            venueName,
            senderName: profile.displayName,
            introMessage: intro,
          });
        }}
      />
      <ReportModal visible={report} onClose={() => setReport(false)} theme={theme} targetType="shytext" targetId={post.id} />
    </Screen>
  );
}
