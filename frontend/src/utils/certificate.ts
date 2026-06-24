import api from '../services/api';

export const downloadCourseCertificate = async (courseId: string, courseTitle: string): Promise<void> => {
  const response = await api.get(`/courses/${courseId}/certificate`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Diploma - ${courseTitle}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
