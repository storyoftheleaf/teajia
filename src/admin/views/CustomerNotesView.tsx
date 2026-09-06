import React from 'react';
import { CustomerNotesReview } from '../components/CustomerNotesReview';

/**
 * The room where the shop reads what customers wrote and decides what the teas
 * carry. Nothing on a product page quotes a customer until it passes through
 * here, which is the point of it being a room rather than a control tucked
 * inside a product form.
 */
export default function CustomerNotesView() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 lg:px-6">
      <h1 className="m-0 font-display text-ui-26 leading-tight text-tea-text">Tasting notes</h1>
      <p className="mt-1.5 max-w-[52ch] text-ui-12 leading-relaxed text-tea-text-sec">
        What people have written about your teas. Publish one and it appears on
        that tea under the name you give it, beside your own note.
      </p>
      <div className="mt-6">
        <CustomerNotesReview />
      </div>
    </div>
  );
}
