import { PhoneAuthForm } from '../../components/PhoneAuthForm';
import { useTranslation } from 'react-i18next';

export default function SignInScreen() {
  const { t } = useTranslation();
  return (
    <PhoneAuthForm
      title={t('auth.welcomeBack')}
      body={t('auth.welcomeBackBody')}
      footerLabel={t('auth.newHere')}
      footerAction={t('auth.createAccount')}
      footerHref="/(auth)/create-account"
    />
  );
}
