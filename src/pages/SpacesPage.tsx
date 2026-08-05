import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '../components/Icons';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { api } from '../lib/api';

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '';

type SpaceStatus = 'active' | 'by-appointment' | 'coming-soon';

interface Space {
  id: string;
  name: string;
  description: string | null;
  type: string;
  location: string | null;
  host?: string | null;
  status: SpaceStatus;
  isPrivate: boolean;
}

const FALLBACK_SPACES: Space[] = [
  {
    id: 'teajia-home-1',
    name: 'The Tea Room',
    description: 'A dedicated gongfu space for private sessions and small gatherings.',
    type: 'Private Tea Room',
    location: 'Ubud, Bali',
    host: 'Adrian',
    status: 'active',
    isPrivate: true,
  },
  {
    id: 'teajia-home-2',
    name: 'The Second Room',
    description: 'A second tea space at home, used for more intimate one-on-one sessions.',
    type: 'Private Tea Room',
    location: 'Ubud, Bali',
    host: 'Adrian',
    status: 'by-appointment',
    isPrivate: true,
  },
  {
    id: 'teajia-studio',
    name: 'The Studio Tea Room',
    description: "Tea space within Adrian's art studio, where tea and creative practice meet.",
    type: 'Studio',
    location: 'Ubud, Bali',
    host: 'Adrian',
    status: 'by-appointment',
    isPrivate: false,
  },
];

const STATUS_LABEL: Record<SpaceStatus, string> = {
  'active': 'Active',
  'by-appointment': 'By Appointment',
  'coming-soon': 'Coming Soon',
};

const StatusBadge: React.FC<{ status: SpaceStatus }> = ({ status }) => {
  const colorClass =
    status === 'active'
      ? 'text-tea-gold'
      : status === 'by-appointment'
      ? 'text-tea-text-sec'
      : 'text-tea-text-dim';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.15em] ${colorClass}`}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          status === 'active'
            ? 'bg-tea-gold'
            : status === 'by-appointment'
            ? 'bg-tea-text-sec'
            : 'bg-tea-text-dim'
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
};

export const SpacesPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: apiSpaces } = useQuery<Space[]>({
    queryKey: ['venues-public'],
    queryFn: () => api.venues.listPublic(),
    staleTime: 5 * 60 * 1000,
  });

  const spaces = apiSpaces && apiSpaces.length > 0 ? apiSpaces : FALLBACK_SPACES;

  const buildInquiryUrl = (spaceName: string) => {
    const message = `Hi Adrian, I'd like to learn more about ${spaceName} and how to book a session.`;
    return buildWhatsAppUrl(WHATSAPP_NUMBER, message);
  };

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out] pb-nav-gap">
      <Helmet>
        <title>Our Spaces · Teajia</title>
        <meta
          name="description"
          content="Tea spaces connected to the Teajia network. Private rooms, studios, and spaces for sessions in Ubud, Bali."
        />
      </Helmet>

      {/* Back nav */}
      <div className="pt-6 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors duration-200 min-h-[44px]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <Icons.ChevronLeft className="w-4 h-4" />
          <span className="text-ui-13">Back</span>
        </button>
      </div>

      {/* Header */}
      <header className="pt-8 pb-10 max-w-[640px]">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-ui-11 uppercase tracking-[0.3em] text-tea-text-dim mb-4"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          The Teajia network
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="text-[2.2rem] md:text-[3rem] font-normal text-tea-text leading-[1.1] tracking-[-0.02em] mb-5"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Our Spaces
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-ui-15 text-tea-text-sec leading-[1.85]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Tea spaces connected to the Teajia network. Each one is a real room, not a venue, not a
          service. A place where tea is taken seriously.
        </motion.p>
      </header>

      {/* Space cards */}
      <section className="max-w-[720px] pb-16">
        <ul className="flex flex-col gap-0">
          {spaces.map((space, i) => (
            <motion.li
              key={space.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              {i > 0 && <div className="h-px bg-tea-border/30" />}
              <div className="py-8 md:py-10">
                {/* Card header row */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex flex-col gap-1.5">
                    <h2
                      className="text-[1.25rem] md:text-[1.4rem] font-normal text-tea-text leading-snug tracking-[-0.01em]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {space.name}
                    </h2>
                    {/* Type badge */}
                    <span
                      className="text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim"
                      style={{ fontFamily: 'var(--font-sans)' }}
                    >
                      {space.type}
                    </span>
                  </div>
                  <StatusBadge status={space.status} />
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 mb-4">
                  <Icons.Location className="w-3 h-3 text-tea-gold shrink-0" />
                  <span
                    className="text-ui-11 uppercase tracking-[0.18em] text-tea-text-dim"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {space.location}
                  </span>
                </div>

                {/* Description */}
                <p
                  className="text-ui-14 text-tea-text-sec leading-[1.85] mb-5 max-w-[520px]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {space.description}
                </p>

                {/* Private notice */}
                {space.isPrivate && (
                  <div className="flex items-center gap-2 mb-5">
                    <Icons.Lock className="w-3 h-3 text-tea-text-dim shrink-0" />
                    <span
                      className="text-ui-11 text-tea-text-dim tracking-[0.04em]"
                      style={{ fontFamily: 'var(--font-sans)' }}
                    >
                      Private, by invitation or inquiry
                    </span>
                  </div>
                )}

                {/* Inquire link */}
                <a
                  href={buildInquiryUrl(space.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec hover:text-tea-text transition-colors duration-200 min-h-[44px]"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  <span>Inquire via WhatsApp</span>
                  <Icons.ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* Divider */}
      <div className="divider-warm max-w-[720px]" />

      {/* Operator prompt */}
      <div className="py-12 md:py-16 max-w-[560px]">
        <p
          className="text-ui-13 text-tea-text-dim leading-[1.7] mb-3"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Operate a tea space?
        </p>
        <Link
          to="/for-your-space"
          className="inline-flex items-center gap-2 text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec hover:text-tea-text transition-colors duration-200 min-h-[44px]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <span>Get in touch</span>
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

    </div>
  );
};

export default SpacesPage;
