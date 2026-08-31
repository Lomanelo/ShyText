import { PhoneAuthForm } from '../../components/PhoneAuthForm';

export default function CreateAccountScreen() {
  return (
    <PhoneAuthForm
      title="What’s your number?"
      body="We’ll text a verification code. Your number stays private — other people never see it."
      footerLabel="Already have an account?"
      footerAction="Sign in"
      footerHref="/(auth)/sign-in"
    />
  );
}
