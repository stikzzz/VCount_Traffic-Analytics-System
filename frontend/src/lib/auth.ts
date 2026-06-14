export const setAuthData = (token: string, role: string, email: string, name: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_role', role);
    localStorage.setItem('auth_email', email);
    localStorage.setItem('auth_name', name);
  }
};

export const clearAuthData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_name');
  }
};

export const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
};

export const getAuthRole = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_role');
  }
  return null;
};

export const getAuthEmail = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_email');
  }
  return null;
};

export const getAuthName = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_name');
  }
  return null;
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

export const isAdmin = () => {
  return getAuthRole() === 'admin';
};
