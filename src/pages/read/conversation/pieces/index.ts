/**
 * Every conversation piece. The rule tests and the read-next rail test walk
 * this list, so a new conversation is covered the moment it is added here.
 */
import type { ConversationSpec } from '../spec';
import { porcelainAndTea } from './porcelainAndTea';

export const CONVERSATIONS: ConversationSpec[] = [porcelainAndTea];
