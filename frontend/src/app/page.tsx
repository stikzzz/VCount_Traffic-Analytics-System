import { redirect } from 'next/navigation';

export default function Home() {
  // Automatically redirect any user visiting the root "localhost:3000/" straight to the login page
  redirect('/login');
}
