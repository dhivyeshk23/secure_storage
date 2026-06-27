import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, Trash2, Share2, Search, Loader2, Download, X, Lock, Shield } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const Dashboard = () => {
  const { user } = useAuthStore();
  const isRegularUser = user?.roles?.includes('User') && !user?.roles?.includes('Admin') && !user?.roles?.includes('Security Manager');
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [usage, setUsage] = useState({ used: '0', limit: '104857600' });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Share modal state
  const [shareModal, setShareModal] = useState(null); // fileId or null
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('VIEW_ONLY');
  const [sharePassword, setSharePassword] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Download password modal state
  const [downloadModal, setDownloadModal] = useState(null); // fileId or null
  const [downloadPassword, setDownloadPassword] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchFiles = async () => {
    try {
      const res = await api.get('/files');
      setFiles(res.data.files);
      setUsage(res.data.usage);
    } catch (error) {
      toast.error('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('File encrypted and uploaded securely');
      fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDownload = async () => {
    if (!downloadModal || !downloadPassword) return;
    setIsDownloading(true);
    try {
      const res = await api.get(`/files/download/${downloadModal.id}`, {
        responseType: 'blob',
        headers: { 'x-vault-password': downloadPassword }
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadModal.originalFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('File decrypted and downloaded');
      setDownloadModal(null);
      setDownloadPassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Download failed. Check your password.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!shareModal || !shareEmail || !sharePassword) return;
    setIsSharing(true);
    try {
      await api.post('/files/share', {
        fileId: shareModal,
        recipientEmail: shareEmail,
        permission: sharePermission,
        password: sharePassword
      });
      toast.success('File shared successfully');
      setShareModal(null);
      setShareEmail('');
      setSharePassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Sharing failed');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure? This permanently deletes the encrypted file from the cloud.')) return;
    try {
      await api.delete(`/files/${fileId}`);
      toast.success('File deleted');
      fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Delete failed');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const usedMB = (Number(usage.used) / (1024 * 1024)).toFixed(2);
  const limitMB = (Number(usage.limit) / (1024 * 1024)).toFixed(0);
  const usagePercent = Number(usage.limit) > 0 ? Math.min((Number(usage.used) / Number(usage.limit)) * 100, 100) : 0;

  const filteredFiles = files.filter(f =>
    f.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">My Vault</h2>
          {user?.name && <p className="text-muted-foreground text-sm mt-1">Welcome back, {user.name}</p>}
        </div>
        {isRegularUser && (
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-md py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Storage Usage Bar — Users only */}
      {isRegularUser && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Storage Usage</span>
            <span className="text-sm text-muted-foreground">{usedMB} MB / {limitMB} MB</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${usagePercent}%`,
                background: usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : 'hsl(var(--primary))'
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{(Number(limitMB) - Number(usedMB)).toFixed(2)} MB remaining</p>
        </div>
      )}

      {/* Upload Dropzone — Users only */}
      {isRegularUser && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-card/50 hover:bg-card hover:border-primary/50'}
          `}
        >
          <input {...getInputProps()} />
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-primary" />
            )}
          </div>
          <h3 className="text-lg font-medium">
            {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
          </h3>
          <p className="text-muted-foreground mt-2 text-sm text-center max-w-sm">
            Files are encrypted using AES-256-GCM before being stored in the cloud.
          </p>
        </div>
      )}

      {/* Non-user role info */}
      {!isRegularUser && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4 inline-flex">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">Administrative Account</h3>
          <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
            File upload and storage resources are allocated to regular users only.
            Use the {user?.roles?.includes('Admin') ? 'Admin Console' : 'Security Manager'} panel to manage the platform.
          </p>
        </div>
      )}

      {/* File List — Users only */}
      {isRegularUser && (
        <>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <h3 className="font-medium">My Files</h3>
            <span className="text-xs text-muted-foreground">{filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}</span>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {searchQuery ? 'No files match your search.' : 'No files uploaded yet.'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredFiles.map((file) => (
                <div key={file.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-md text-primary shrink-0">
                      <File className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{file.originalFilename}</p>
                      <p className="text-xs text-muted-foreground">
                        {(Number(file.fileSize) / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}
                        <span className="ml-2 text-green-500">● AES-256-GCM</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setDownloadModal(file); setDownloadPassword(''); }}
                      className="p-2 hover:bg-blue-500/10 hover:text-blue-500 rounded-md transition-colors"
                      title="Download & Decrypt"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setShareModal(file.id); setShareEmail(''); setSharePassword(''); }}
                      className="p-2 hover:bg-primary/10 hover:text-primary rounded-md transition-colors"
                      title="Share"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Download Modal */}
        {downloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDownloadModal(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Decrypt & Download</h3>
                <button onClick={() => setDownloadModal(null)} className="p-1 hover:bg-muted rounded-md"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your account password to decrypt <span className="font-medium text-foreground">{downloadModal.originalFilename}</span>
              </p>
              <input
                type="password"
                value={downloadPassword}
                onChange={(e) => setDownloadPassword(e.target.value)}
                placeholder="Your account password"
                className="w-full bg-input/50 border border-border rounded-lg py-2 px-4 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
              />
              <button
                onClick={handleDownload}
                disabled={!downloadPassword || isDownloading}
                className="w-full bg-primary text-primary-foreground font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-70"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Decrypt & Download'}
              </button>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShareModal(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><Share2 className="w-5 h-5 text-primary" /> Share File</h3>
                <button onClick={() => setShareModal(null)} className="p-1 hover:bg-muted rounded-md"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full bg-input/50 border border-border rounded-lg py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Permission</label>
                  <select
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value)}
                    className="w-full bg-input/50 border border-border rounded-lg py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="VIEW_ONLY">View Only</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="VIEW_AND_DOWNLOAD">View & Download</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Your Password (to re-encrypt for recipient)</label>
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Your account password"
                    className="w-full bg-input/50 border border-border rounded-lg py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <button
                  onClick={handleShare}
                  disabled={!shareEmail || !sharePassword || isSharing}
                  className="w-full bg-primary text-primary-foreground font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-70 mt-2"
                >
                  {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Share Securely'}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
