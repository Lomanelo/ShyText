import { PhoneAuthForm } from '../../components/PhoneAuthForm';

export default function CreateAccountScreen() {
  return (
    <PhoneAuthForm
      title="What’s your number?"
      body="We’ll text a code. Nobody else sees this number."
      footerLabel="Already have an account?"
      footerAction="Sign in"
      footerHref="/(auth)/sign-in"
    />
  );
}
