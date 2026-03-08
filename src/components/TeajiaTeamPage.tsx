import React from 'react';
import { Icons } from './Icons';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
  socialLinks?: {
    instagram?: string;
    email?: string;
    [key: string]: string | undefined;
  };
}

interface TeajiaTeamPageProps {
  teamMembers?: TeamMember[];
}

export const TeajiaTeamPage: React.FC<TeajiaTeamPageProps> = ({ teamMembers = [] }) => {
  // Default team members if none provided
  const defaultTeam: TeamMember[] = [
    {
      id: 'team-001',
      name: 'Founder & Tea Master',
      role: 'Visionary',
      bio: 'Leading the journey to connect communities through tea culture and mindful living.',
      photo: '/images/team/founder.jpg',
      socialLinks: {
        instagram: 'https://instagram.com/teajia',
      },
    },
    {
      id: 'team-002',
      name: 'Community Liaison',
      role: 'Connection Builder',
      bio: 'Bridging relationships between Teajia and our global tea community.',
      photo: '/images/team/community-lead.jpg',
      socialLinks: {
        instagram: 'https://instagram.com/teajia.community',
      },
    },
    {
      id: 'team-003',
      name: 'Curation Lead',
      role: 'Storyteller',
      bio: 'Sourcing and sharing the finest teas and resources from around the world.',
      photo: '/images/team/curator.jpg',
    },
  ];

  const team = teamMembers.length > 0 ? teamMembers : defaultTeam;

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      {/* Header Section */}
      <div className="bg-gradient-to-b from-tea-seal/10 dark:from-tea-seal/5 to-transparent py-16 px-4 mb-12">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-serif text-4xl md:text-5xl text-tea-text mb-4">
            The Teajia Family
          </h1>
          <p className="text-lg text-tea-text/70">
            We are a community-first organization dedicated to celebrating tea culture and building meaningful connections around the world.
          </p>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="max-w-5xl mx-auto px-4 mb-16">
        <div className="bg-tea-bg rounded-lg p-8 md:p-12 border border-tea-gold/20">
          <h2 className="font-serif text-2xl text-tea-text mb-4">Our Mission</h2>
          <p className="text-tea-text/80 text-lg leading-relaxed">
            Teajia exists to elevate tea from a beverage to a practice of mindfulness and connection. We believe in the transformative power of tea ceremonies, the stories behind every leaf, and the communities that cultivate and celebrate this ancient tradition. Through our platform, we honor tea heritage while building contemporary spaces for learning, discovery, and belonging.
          </p>
        </div>
      </div>

      {/* Team Members */}
      <div className="max-w-6xl mx-auto px-4 mb-24">
        <h2 className="font-serif text-3xl text-tea-text mb-12 text-center">
          Meet Our Team
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {team.map((member) => (
            <div
              key={member.id}
              className="text-center group animate-[fadeIn_0.6s_ease-out]"
            >
              {/* Photo */}
              <div className="mb-6 relative overflow-hidden rounded-lg bg-tea-text/5 aspect-square flex items-center justify-center">
                {member.photo ? (
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Icons.User className="w-24 h-24 text-tea-text/20" />
                )}
              </div>

              {/* Info */}
              <h3 className="font-serif text-xl text-tea-text mb-1">
                {member.name}
              </h3>
              <p className="text-sm uppercase tracking-[0.15em] text-tea-gold mb-3">
                {member.role}
              </p>
              <p className="text-tea-text/70 text-sm leading-relaxed mb-4">
                {member.bio}
              </p>

              {/* Social Links */}
              {member.socialLinks && (
                <div className="flex justify-center gap-3">
                  {member.socialLinks.instagram && (
                    <a
                      href={member.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-tea-gold/8 text-tea-text/60 hover:text-tea-gold transition-all"
                      title="Instagram"
                    >
                      <Icons.Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {member.socialLinks.email && (
                    <a
                      href={`mailto:${member.socialLinks.email}`}
                      className="p-2 rounded-full hover:bg-tea-gold/8 text-tea-text/60 hover:text-tea-gold transition-all"
                      title="Email"
                    >
                      <Icons.Mail className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Values Section */}
      <div className="bg-tea-gold/5/5 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl text-tea-text mb-12 text-center">
            Our Values
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-tea-gold/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Leaf className="w-6 h-6 text-tea-gold" />
              </div>
              <h3 className="font-serif text-xl text-tea-text mb-2">
                Community First
              </h3>
              <p className="text-tea-text/70">
                We prioritize relationships and shared experiences over commerce.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-tea-gold/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Palette className="w-6 h-6 text-tea-gold" />
              </div>
              <h3 className="font-serif text-xl text-tea-text mb-2">
                Authenticity
              </h3>
              <p className="text-tea-text/70">
                We honor tea traditions while embracing contemporary practice.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-tea-gold/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Lightbulb className="w-6 h-6 text-tea-gold" />
              </div>
              <h3 className="font-serif text-xl text-tea-text mb-2">
                Mindfulness
              </h3>
              <p className="text-tea-text/70">
                Tea is a practice of presence, intention, and reflection.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
