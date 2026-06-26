/* ================================================================
 * Room Page — Dynamic route /room/[roomId]
 *
 * Server component that passes roomId to the client RoomView.
 * ================================================================ */

import RoomView from '@/components/RoomView';

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { roomId } = await params;
  return <RoomView roomId={roomId} />;
}

export async function generateMetadata({ params }: Props) {
  const { roomId } = await params;
  return {
    title: `SyncPlay — Room ${roomId}`,
    description: '실시간 동기화 시청 중',
  };
}
