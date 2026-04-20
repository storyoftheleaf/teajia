import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TastingJournal } from '../components/AccountPanel/TastingJournal';

export default function JournalPage() {
  const navigate = useNavigate();
  return (
    <TastingJournal
      onBack={() => navigate(-1)}
      onOrderTea={(teaId) => navigate(`/shop/product/${teaId}`)}
    />
  );
}
