import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock axios before importing components that import it
jest.mock('axios', () => require('../../__mocks__/axios'));

import Login from '../Login';

test('renders login UI with form and test credentials', () => {
  render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );

  expect(screen.getByText('Jyoti Login')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('analyst@example.com')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  expect(screen.getByText(/Admin credentials/i)).toBeInTheDocument();
});
