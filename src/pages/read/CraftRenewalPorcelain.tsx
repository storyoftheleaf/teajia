/**
 * Shangyin Qiwu: Porcelain and Tea. The words and photographs live in
 * conversation/pieces/porcelainAndTea.ts; the layout is the shared
 * conversation template, so a change to either reaches every conversation.
 */
import React from 'react';
import ConversationArticle from './conversation/ConversationArticle';
import { porcelainAndTea } from './conversation/pieces/porcelainAndTea';

const CraftRenewalPorcelain: React.FC = () => <ConversationArticle spec={porcelainAndTea} />;

export default CraftRenewalPorcelain;
