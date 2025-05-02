import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  ViewStyle,
  TextStyle
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { database } from '../../src/lib/firebase';
import { ref, push } from 'firebase/database';
import { auth } from '../../src/lib/firebase';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ContactFormProps {
  onClose: () => void;
}

interface Styles {
  keyboardAvoidingView: ViewStyle;
  modalContainer: ViewStyle;
  container: ViewStyle;
  scrollView: ViewStyle;
  header: ViewStyle;
  title: TextStyle;
  closeButton: ViewStyle;
  form: ViewStyle;
  inputContainer: ViewStyle;
  label: TextStyle;
  input: TextStyle;
  textArea: TextStyle;
  submitButton: ViewStyle;
  submitButtonDisabled: ViewStyle;
  gradient: ViewStyle;
  submitButtonText: TextStyle;
}

export default function ContactForm({ onClose }: ContactFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !question.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be signed in to submit a question');
        return;
      }

      const formsRef = ref(database, 'forms');
      await push(formsRef, {
        userId: currentUser.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        question: question.trim(),
        createdAt: new Date().toISOString(),
        status: 'pending'
      });

      Alert.alert('Success', 'Your question has been submitted successfully!');
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', 'Failed to submit your question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalContainer}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Help & Support</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter your first name"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter your last name"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Your Question</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="How can we help you?"
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[colors.ui.primary, colors.ui.primary]}
                    style={styles.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.text.light} size="small" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit Question</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create<Styles>({
  keyboardAvoidingView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    width: Math.min(SCREEN_WIDTH - spacing.xxl * 2, 500),
    maxHeight: '85%',
    ...shadows.large,
  },
  scrollView: {
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.ghost,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  form: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  inputContainer: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.md,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  input: {
    backgroundColor: colors.ui.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    minHeight: 50,
  },
  textArea: {
    height: 150,
    paddingTop: spacing.lg,
  },
  submitButton: {
    height: 56,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
    ...shadows.medium,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: colors.text.light,
    fontSize: typography.fontSize.md,
    fontWeight: '600' as const,
  },
}); 