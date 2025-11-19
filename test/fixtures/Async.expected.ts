// Extremely malformatted async example
async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  return data;
}

async function processMultiple(urls: string[]): Promise<any[]> {
  const promises = urls.map(url => fetchData(url));
  const results = await Promise.all(promises);
  return results.filter(r => r !== null);
}

export { fetchData, processMultiple };

type ApiResponse<T> = { success: boolean; data: T | null; error: string | null };

async function apiCall<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const data = await fetchData(endpoint);
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}
