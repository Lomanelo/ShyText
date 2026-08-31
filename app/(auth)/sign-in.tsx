import { PhoneAuthForm } from '../../components/PhoneAuthForm';

export default function SignInScreen() {
  return (
    <PhoneAuthForm
      title="Welcome back"
      body="Sign in with the mobile number on your account."
      footerLabel="New here?"
      footerAction="Create an account"
      footerHref="/(auth)/create-account"
    />
  );
}
