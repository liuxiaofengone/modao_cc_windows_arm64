import { session, Session } from 'electron';

let sharedSession: Session | null = null;

export function getSharedSession(): Session {
  if (!sharedSession) {
    sharedSession = session.fromPartition('persist:modao', { cache: true });
  }
  return sharedSession;
}
