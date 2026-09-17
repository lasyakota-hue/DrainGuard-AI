const API_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export const getDashboard = () => {
  return request("/dashboard");
};

export const acknowledgeIncident = (id) => {
  return request(`/incidents/${id}/acknowledge`, {
    method: "PATCH"
  });
};

export const startCleaning = (id) => {
  return request(`/incidents/${id}/clean`, {
    method: "PATCH"
  });
};

export const verifyCleanup = (data) => {
  return request("/cleanup/verify", {
    method: "POST",
    body: JSON.stringify(data)
  });
};