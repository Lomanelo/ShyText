import { Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { type, useTheme } from '../../theme';

export default function ShyTextDetailScreen() {
  const theme = useTheme();
  return (
    <Screen theme={theme} inset={false}>
      <Text style={[type.body, { padding: 20, color: theme.muted }]}>They’re no longer visible.</Text>
    </Screen>
  );
}
