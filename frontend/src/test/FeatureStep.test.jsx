import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import FeatureStep from '../components/features/FeatureStep.jsx';
import { EstimateProvider } from '../context/EstimateContext.jsx';
import { useEstimate } from '../hooks/useEstimate.js';
import { usePricing } from '../hooks/usePricing.js';

const features = [
  { id: 1, category_id: 1, name: 'Frontend', description: 'UI', basic_price: '15000', intermediate_price: '25000', advanced_price: '35000', estimated_hours: '20', default_internal_cost: '0' },
  { id: 2, category_id: 1, name: 'Auth', description: '', basic_price: '5000', intermediate_price: '8000', advanced_price: '15000', estimated_hours: '10', default_internal_cost: '0' },
];

function Harness() {
  const est = useEstimate();
  const p = usePricing(est.state, features, []);
  return (<><FeatureStep est={est} features={features} errors={{}} /><output data-testid="total">{p.display.final_client_price}</output></>);
}
const setup = () => render(<EstimateProvider><Harness /></EstimateProvider>);

describe('feature selection', () => {
  it('updates the price immediately when features are selected and deselected', async () => {
    setup();
    const user = userEvent.setup();
    expect(screen.getByTestId('total')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'Frontend' }));
    expect(screen.getByTestId('total')).toHaveTextContent('15000');
    await user.click(screen.getByRole('button', { name: 'Auth' }));
    expect(screen.getByTestId('total')).toHaveTextContent('20000');
    await user.click(screen.getByRole('button', { name: 'Frontend' }));
    expect(screen.getByTestId('total')).toHaveTextContent('5000');
  });
  it('multiplies by quantity', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Auth' }));
    await user.click(screen.getByRole('button', { name: 'Increase Auth quantity' }));
    expect(screen.getByTestId('total')).toHaveTextContent('10000');
  });
  it('adds a custom feature and rejects an empty name', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add feature' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the feature a name');
    await user.type(screen.getByLabelText('New feature name'), 'Report');
    await user.type(screen.getAllByLabelText('Price (INR)').at(-1), '2500');
    await user.click(screen.getByRole('button', { name: 'Add feature' }));
    expect(screen.getByTestId('total')).toHaveTextContent('2500');
  });
});
