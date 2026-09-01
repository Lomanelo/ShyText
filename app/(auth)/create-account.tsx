import { PhoneAuthForm } from '../../components/PhoneAuthForm';
import { useTranslation } from 'react-i18next';

export default function CreateAccountScreen() {
  const { t } = useTranslation();
  return (
    <PhoneAuthForm
      title={t('auth.whatsNumber')}
      body={t('auth.whatsNumberBody')}
      footerLabel={t('auth.alreadyHave')}
      footerAction={t('auth.signIn')}
      footerHref="/(auth)/sign-in"
    />
  );
}
