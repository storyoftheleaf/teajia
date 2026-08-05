import React from 'react';
import { Helmet } from 'react-helmet-async';
import { StoreLaunchPlaybook } from '../components/storeLaunch/StoreLaunchPlaybook';

const StoreLaunchPlaybookPage: React.FC = () => (
  <>
    <Helmet>
      <title>Store Launch Playbook · Teajia</title>
      <meta
        name="description"
        content="A practical store-opening page for Teajia operators: profile, people, opening stock, storefront, first sale, and first event."
      />
    </Helmet>
    <StoreLaunchPlaybook mode="public" />
  </>
);

export default StoreLaunchPlaybookPage;
