import React, { useMemo, useState } from 'react';
import { Icons } from './Icons';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderSubtitle } from './shared/PageHeaderSubtitle';
import { DesignPortfolio } from './DesignPortfolio';
import { GuidanceInquiryModal, ServiceType } from './GuidanceInquiryModal';
import { CardContainer } from './shared/CardContainer';
import { TEA_SPACES, SPACE_TYPE_LABELS } from '../data/teaSpaces';

// Static "How It Works" steps - prevent recreation on every render
const HOW_IT_WORKS_STEPS = [
  { id: 'step-1', step: '1', title: 'Connect', description: 'Reach out to discuss your interests and goals' },
  { id: 'step-2', step: '2', title: 'Customize', description: 'We tailor the experience to your needs' },
  { id: 'step-3', step: '3', title: 'Experience', description: 'Enjoy a thoughtfully designed session or event' },
  { id: 'step-4', step: '4', title: 'Continue', description: 'Build an ongoing tea practice with us' },
] as const;

interface OfferingData {
  id: string;
  title: string;
  description: string;
  details: string[];
  iconType: 'teapot' | 'lightbulb' | 'leaf' | 'users' | 'heart';
  category: 'experiences' | 'services' | 'circles';
  categoryLabel: string;
  price?: string;
}

interface Offering extends OfferingData {
  icon: React.ReactNode;
}

interface OfferingCategory {
  id: 'experiences' | 'services' | 'circles';
  title: string;
  description: string;
  iconType: 'teapot' | 'lightbulb' | 'heart';
}

interface OfferingsPageProps {
  onLearnMoreClick?: (offering: Offering) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

const OFFERING_DATA: OfferingData[] = [
  {
    id: 'offering-001',
    title: 'Tea Sessions & Tastings',
    description: 'Guided explorations of tea varieties, brewing techniques, and tea culture from around the world.',
    category: 'experiences',
    categoryLabel: 'Individual & Group',
    details: [
      'Group and private sessions available',
      'Customized to your interests and experience level',
      'Includes samples and tea service',
      'Available in-person and online',
    ],
    iconType: 'teapot',
    price: 'Contact for pricing',
  },
  {
    id: 'offering-002',
    title: 'Tea Space Design & Curation',
    description: 'Create an intentional tea space. We offer design consultation and collection curation services.',
    category: 'services',
    categoryLabel: 'Professional Consultation',
    details: [
      'Space design and layout guidance',
      'Collection curation and sourcing',
      'Aesthetic and functional advice',
      'Ongoing support and updates',
    ],
    iconType: 'lightbulb',
    price: 'Contact for pricing',
  },
  {
    id: 'offering-003',
    title: 'Tea Consultation',
    description: 'Personal guidance for building your tea practice, selecting quality teas, and developing your palate.',
    category: 'services',
    categoryLabel: 'Personal Guidance',
    details: [
      'One-on-one consultation sessions',
      'Personalized tea recommendations',
      'Palate development guidance',
      'Tea sourcing and procurement support',
    ],
    iconType: 'leaf',
    price: 'Contact for pricing',
  },
  {
    id: 'offering-004',
    title: 'Community Circles',
    description: 'Join our regular tea circles and dedicated communities for deepening practice together.',
    category: 'circles',
    categoryLabel: 'Monthly Gatherings',
    details: [
      'Monthly tea circles with themes',
      'Member-only discussions and tastings',
      'Ongoing community support',
      'Access to exclusive content',
    ],
    iconType: 'users',
    price: 'Membership available',
  },
  {
    id: 'offering-005',
    title: 'Corporate Events',
    description: 'Bring mindfulness and connection to your team with custom tea experiences and ceremonies.',
    category: 'circles',
    categoryLabel: 'Team Building',
    details: [
      'Custom-designed ceremonies',
      'Team building through tea',
      'Educational sessions on tea culture',
      'Flexible scheduling and venues',
    ],
    iconType: 'users',
    price: 'Custom quotes',
  },
  {
    id: 'offering-006',
    title: 'Retreats & Special Events',
    description: 'Multi-day immersive experiences exploring tea, culture, and community in depth.',
    category: 'circles',
    categoryLabel: 'Intensive Experiences',
    details: [
      'Weekend and week-long retreats',
      'Seasonal celebration events',
      'Guest speakers and collaborations',
      'Transformative group experiences',
    ],
    iconType: 'heart',
    price: 'Contact for pricing',
  },
];

const CATEGORY_DATA: OfferingCategory[] = [
  {
    id: 'experiences',
    title: 'Experiences',
    description: 'Immersive sessions and tastings',
    iconType: 'teapot',
  },
  {
    id: 'services',
    title: 'Services',
    description: 'Personal guidance and design',
    iconType: 'lightbulb',
  },
  {
    id: 'circles',
    title: 'Events & Circles',
    description: 'Community gatherings and retreats',
    iconType: 'heart',
  },
];

// Pre-generate icon maps for consistency
const ICON_MAP_LARGE: Record<string, React.ReactNode> = {
  teapot: <Icons.Teapot className="w-8 h-8" />,
  lightbulb: <Icons.Lightbulb className="w-8 h-8" />,
  leaf: <Icons.Leaf className="w-8 h-8" />,
  users: <Icons.Users className="w-8 h-8" />,
  heart: <Icons.Heart className="w-8 h-8" />,
};

const ICON_MAP_SMALL: Record<string, React.ReactNode> = {
  teapot: <Icons.Teapot className="w-6 h-6" />,
  lightbulb: <Icons.Lightbulb className="w-6 h-6" />,
  leaf: <Icons.Leaf className="w-6 h-6" />,
  users: <Icons.Users className="w-6 h-6" />,
  heart: <Icons.Heart className="w-6 h-6" />,
};

export const OfferingsPage: React.FC<OfferingsPageProps> = ({ onLearnMoreClick, onCartClick, onAccountClick, cartItemCount = 0 }) => {
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryServiceType, setInquiryServiceType] = useState<ServiceType>('general');

  const handleLearnMore = (offering: Offering) => {
    // Determine service type based on offering
    if (offering.id === 'offering-001' || offering.id === 'offering-003') {
      setInquiryServiceType('teaching');
    } else if (offering.id === 'offering-002') {
      setInquiryServiceType('design');
    } else {
      setInquiryServiceType('general');
    }
    setInquiryModalOpen(true);

    if (onLearnMoreClick) {
      onLearnMoreClick(offering);
    }
  };

  const openDesignInquiry = () => {
    setInquiryServiceType('design');
    setInquiryModalOpen(true);
  };

  const offerings = useMemo<Offering[]>(() => {
    return OFFERING_DATA.map(data => ({
      ...data,
      icon: ICON_MAP_LARGE[data.iconType] || null,
    }));
  }, []);

  const categories = useMemo(() => {
    return CATEGORY_DATA.map(cat => ({
      ...cat,
      icon: ICON_MAP_SMALL[cat.iconType] || null,
    }));
  }, []);

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <PageHeader title="Our Offerings" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount}>
        <PageHeaderSubtitle>
          <p>Experiences and services designed to deepen your connection with tea and our community.</p>
        </PageHeaderSubtitle>
      </PageHeader>

      {/* Process Section - How It Works */}
      <div className="bg-tea-gold/5/5 py-16 lg:py-20 px-4 mb-16 lg:mb-24 mt-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl lg:text-4xl text-tea-text mb-12 text-center">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-10">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div key={item.id} className="text-center">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-tea-gold text-white rounded-full flex items-center justify-center mx-auto mb-4 font-serif text-lg lg:text-xl font-bold">
                  {item.step}
                </div>
                <h4 className="font-serif text-lg lg:text-xl text-tea-text mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-tea-text/70">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offerings by Category */}
      <div className="max-w-6xl mx-auto px-4 mb-24 lg:mb-36">
        {categories.map((category) => {
          const categoryOfferings = offerings.filter(o => o.category === category.id);

          return (
            <div key={category.id} className="mb-16 lg:mb-24">
              {/* Category Header */}
              <div className="flex items-center gap-4 mb-8 lg:mb-12 pb-6 border-b border-tea-border">
                <div className="text-tea-gold">{category.icon}</div>
                <div className="flex-1">
                  <h2 className="text-2xl lg:text-3xl font-serif text-tea-text">{category.title}</h2>
                  <p className="text-sm text-tea-text/60">{category.description}</p>
                </div>
              </div>

              {/* Offerings Grid — 2 cols on tablet, 3 cols on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
                {categoryOfferings.map((offering) => (
                  <div
                    key={offering.id}
                    className="group bg-tea-bg rounded-lg p-8 border border-tea-border hover:border-tea-gold/30 transition-all duration-300 hover:shadow-lg md:hover:-translate-y-1 animate-[fadeIn_0.6s_ease-out]"
                  >
                    {/* Category Label */}
                    <div className="mb-4">
                      <span className="text-[11px] uppercase tracking-wider font-medium text-tea-gold">
                        {offering.categoryLabel}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className="w-14 h-14 bg-tea-gold/8 rounded-lg flex items-center justify-center mb-6 group-hover:bg-tea-gold/15 dark:group-hover:bg-tea-gold/25 transition-colors text-tea-gold">
                      {offering.icon}
                    </div>

                    {/* Title */}
                    <h3 className="font-serif text-2xl text-tea-text mb-3 group-hover:text-tea-gold transition-colors">
                      {offering.title}
                    </h3>

                    {/* Description */}
                    <p className="text-tea-text/70 mb-6">
                      {offering.description}
                    </p>

                    {/* Details List */}
                    <ul className="space-y-3 mb-6">
                      {offering.details.map((detail, idx) => (
                        <li key={idx} className="flex gap-3 text-sm text-tea-text/80">
                          <Icons.Check className="w-5 h-5 text-tea-gold flex-shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Price & CTA */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-tea-border">
                      {offering.price && (
                        <p className="text-sm text-tea-gold font-medium">{offering.price}</p>
                      )}
                      <button onClick={() => handleLearnMore(offering)} className="w-full py-3 px-4 bg-tea-gold/8 text-tea-gold hover:bg-tea-gold/15 dark:hover:bg-tea-gold/25 rounded-lg font-medium transition-all duration-300 group-hover:bg-tea-gold group-hover:text-white">
                        Learn More
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tea Space Inspiration Section */}
      <div className="max-w-6xl mx-auto px-4 mb-16 lg:mb-24">
        <div className="flex items-center gap-4 mb-8 lg:mb-12 pb-6 border-b border-tea-border">
          <div className="text-tea-gold"><Icons.Palette className="w-6 h-6" /></div>
          <div className="flex-1">
            <h2 className="text-2xl lg:text-3xl font-serif text-tea-text">Tea Space Inspiration</h2>
            <p className="text-sm text-tea-text/60">Ideas and guidance for creating your own ceremony environment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {TEA_SPACES.map(space => (
            <CardContainer key={space.id} className="hover:-translate-y-0.5 transition-all">
              <div className="p-5">
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-tea-gold/8 text-tea-gold border border-tea-border">
                  {SPACE_TYPE_LABELS[space.spaceType]}
                </span>
                <h3 className="font-serif text-lg text-tea-text mt-3 mb-2">
                  {space.title}
                </h3>
                <p className="text-sm text-tea-text/60 mb-4 leading-relaxed">
                  {space.description}
                </p>
                <ul className="space-y-2">
                  {space.tips.slice(0, 2).map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-tea-text/50">
                      <Icons.Check className="w-3.5 h-3.5 text-tea-gold shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContainer>
          ))}
        </div>

        <button
          onClick={openDesignInquiry}
          className="flex items-center justify-between w-full py-4 px-5 rounded-lg bg-tea-gold/5 hover:bg-tea-gold/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Icons.Sparkles className="w-5 h-5 text-tea-gold" />
            <div className="text-left">
              <span className="text-base font-medium text-tea-text">
                Want a Custom Tea Space?
              </span>
              <p className="text-sm text-tea-text/50">
                Let us help you design and curate the perfect ceremony environment
              </p>
            </div>
          </div>
          <Icons.Next className="w-5 h-5 text-tea-gold group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Design Portfolio Section */}
      <div className="max-w-6xl mx-auto px-4 mb-24 lg:mb-36">
        <DesignPortfolio onInquiryClick={openDesignInquiry} maxProjects={3} />
      </div>

      {/* Contact CTA */}
      <div className="max-w-3xl mx-auto px-4 mb-24 lg:mb-36 text-center">
        <h2 className="font-serif text-2xl lg:text-4xl text-tea-text mb-4 lg:mb-6">
          Ready to Begin?
        </h2>
        <p className="text-tea-text/70 mb-8 lg:max-w-xl lg:mx-auto">
          Get in touch to discuss which offering is right for you. We're excited to share the gift of tea.
        </p>
        <button
          onClick={() => setInquiryModalOpen(true)}
          className="px-8 lg:px-12 py-3 lg:py-4 bg-tea-gold text-white font-medium rounded-lg hover:bg-tea-gold/90 transition-colors"
        >
          Contact Us
        </button>
      </div>

      {/* Inquiry Modal */}
      {inquiryModalOpen && (
        <GuidanceInquiryModal
          onClose={() => setInquiryModalOpen(false)}
          initialServiceType={inquiryServiceType}
        />
      )}
    </div>
  );
};
