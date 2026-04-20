import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MyCollection } from '../components/AccountPanel/MyCollection';
import type { InventoryItem } from '../types';

export default function CollectionPage() {
  const navigate = useNavigate();
  return (
    <MyCollection
      onBack={() => navigate(-1)}
      onViewItem={(item: InventoryItem) => navigate(`/shop/product/${item.id}`)}
    />
  );
}
