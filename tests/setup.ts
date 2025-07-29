// Test setup configuration
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Optionally suppress console output in tests
  // console.log = jest.fn();
  // console.warn = jest.fn();
  // console.error = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});