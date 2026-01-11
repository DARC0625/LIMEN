import { redirect } from 'next/navigation';

export default function ConsoleRedirectPage({ params }: { params: { uuid: string } }) {
  redirect(`/vnc/${params.uuid}`);
}
