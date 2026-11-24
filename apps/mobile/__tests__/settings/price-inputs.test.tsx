import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ServicesSettings } from '@/components/settings/ServicesSettings';
import { AddonsSettings } from '@/components/settings/AddonsSettings';
import { NumericInput } from '@/components/ui/NumericInput';
import { api } from '@/lib/api';

jest.mock('twrnc', () => {
  const tw = () => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

// Every icon renders as a host element named after it.
jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_target, name) => (name === '__esModule' ? false : String(name)) })
);

jest.mock('@/hooks/useAuth', () => {
  const value = { user: { id: 'barber-user' } };
  return { useAuth: () => value };
});

jest.mock('@/lib/api', () => {
  const shared = jest.requireActual('@barber-app/shared');
  return {
    api: {
      services: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
      addons: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
    },
    errorMessage: shared.errorMessage,
  };
});

const mockApi = api as unknown as {
  services: { list: jest.Mock; create: jest.Mock };
  addons: { list: jest.Mock; create: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.services.list.mockResolvedValue({ services: [] });
  mockApi.addons.list.mockResolvedValue({ addons: [] });
  mockApi.services.create.mockResolvedValue({ service: {} });
  mockApi.addons.create.mockResolvedValue({ addon: {} });
});

describe('price inputs keep the typed text', () => {
  it('ServicesSettings saves 25.50 as 2550 cents, keeping "25." while typing', async () => {
    const screen = render(<ServicesSettings />);
    await waitFor(() => expect(mockApi.services.list).toHaveBeenCalled());

    fireEvent.changeText(screen.getByPlaceholderText('e.g., Haircut, Beard Trim'), 'Fade');
    const price = screen.getByPlaceholderText('25.00');
    fireEvent.changeText(price, '25.');
    expect(screen.getByDisplayValue('25.')).toBeTruthy();
    fireEvent.changeText(price, '25.50');
    fireEvent.press(screen.getByText('Add Service'));

    await waitFor(() =>
      expect(mockApi.services.create).toHaveBeenCalledWith({
        name: 'Fade',
        priceCents: 2550,
        durationMinutes: 30,
        description: null,
      })
    );
  });

  it('ServicesSettings refuses a price that is not an amount', async () => {
    const screen = render(<ServicesSettings />);
    await waitFor(() => expect(mockApi.services.list).toHaveBeenCalled());
    fireEvent.changeText(screen.getByPlaceholderText('e.g., Haircut, Beard Trim'), 'Fade');
    fireEvent.changeText(screen.getByPlaceholderText('25.00'), '25.505');
    fireEvent.press(screen.getByText('Add Service'));
    expect(await screen.findByText('Enter a price like 25 or 25.50')).toBeTruthy();
    expect(mockApi.services.create).not.toHaveBeenCalled();
  });

  it('AddonsSettings saves cents from the typed text', async () => {
    const screen = render(<AddonsSettings />);
    await waitFor(() => expect(mockApi.addons.list).toHaveBeenCalled());
    const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
    fireEvent.changeText(inputs[0], 'Hot towel');
    fireEvent.changeText(inputs[1], '7.5');
    expect(screen.getByDisplayValue('7.5')).toBeTruthy();
    fireEvent.press(screen.getByText('Add Add-on'));
    await waitFor(() =>
      expect(mockApi.addons.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hot towel', priceCents: 750 }))
    );
  });

  it('NumericInput keeps "30." and reports the number', () => {
    const onChange = jest.fn();
    const screen = render(<NumericInput label="Price" value={30} onChangeText={onChange} placeholder="p" />);
    fireEvent.changeText(screen.getByPlaceholderText('p'), '30.');
    expect(screen.getByDisplayValue('30.')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(30);
    fireEvent.changeText(screen.getByPlaceholderText('p'), '30.75');
    expect(onChange).toHaveBeenLastCalledWith(30.75);
  });
});
