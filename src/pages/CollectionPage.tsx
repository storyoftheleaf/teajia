import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MyCollection } from '../components/AccountPanel/MyCollection';
import type { InventoryItem } from '../types';
import { PersonalTeaLinks } from '../components/account/PersonalTeaLinks';

export default function CollectionPage() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-nav-gap-lg md:px-6">
      <MyCollection
        onBack={() => navigate(-1)}
        onViewItem={(item: InventoryItem) => navigate(`/shop/product/${item.id}`)}
      />
      <PersonalTeaLinks current="favorites" />
    </main>
  );
}
