import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MyCollection } from '../components/AccountPanel/MyCollection';
import type { InventoryItem } from '../types';
import { PersonalTeaLinks } from '../components/account/PersonalTeaLinks';
import { SharedCollectionsSection } from './SharedCollectionsPage';

export default function CollectionPage() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-nav-gap-lg md:px-6">
      <MyCollection
        onBack={() => navigate(-1)}
        onViewItem={(item: InventoryItem) => navigate(`/shop/product/${item.id}`)}
      />
      {/* Remember holds everything kept: teas you favourited, and collections
          someone shared with you (their own tile until 2026-09-29). */}
      <div className="mt-12">
        <SharedCollectionsSection embedded />
      </div>
      <PersonalTeaLinks current="favorites" />
    </main>
  );
}
