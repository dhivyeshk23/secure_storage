import { useState, useRef, useEffect } from 'react';
import { storeData, storeFile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FILE_TYPE_ICONS } from '../components/Navbar';

const ACCEPTED_FORMATS = {
  'Images': '.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff',
  'Audio': '.mp3,.wav,.ogg,.flac,.aac,.m4a',
  'Video': '.mp4,.webm,.avi,.mov,.mkv',
  'Documents': '.pdf,.doc,.docx,.odt,.rtf',
  'Spreadsheets': '.xlsx,.xls,.csv,.ods',
  'Archives': '.zip,.rar,.7z,.tar,.gz'
};
const ALL_FORMATS = Object.values(ACCEPTED_FORMATS).join(',');

export default function StoreData() {
  const { user } = useAuth();
  const [form, setForm] = useState({ title: '', data: '', sensitivityLevel: 'LOW' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadMode, setUploadMode] = useState('text');
  const fileInputRef = useRef(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        const fileName = `voice-note-${new Date().getTime()}.webm`;
        const file = new File([audioBlob], fileName, { type: 'audio/webm' });
        setSelectedFile(file);
        if (!form.title) setForm(prev => ({ ...prev, title: 'Voice Note' }));

        // Stop all tracks in the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setAudioUrl(null);
    setSelectedFile(null);
    setRecordingTime(0);
    if (!form.data) setForm(prev => ({ ...prev, title: '' }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) return <div className="loading">Loading...</div>;

  const accessLevels = {
    admin: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    student: ['LOW', 'MEDIUM', 'HIGH'],
    professor: ['LOW']
  };
  const allowedLevels = accessLevels[user?.role] || ['LOW'];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError('');
      if (!form.title) {
        setForm(prev => ({ ...prev, title: file.name.split('.')[0] }));
      }
    }
  };

  const getFileCategory = (file) => {
    if (!file) return 'other';
    const mime = file.type;
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.includes('word') || mime.includes('document') || mime === 'application/rtf') return 'document';
    if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return 'spreadsheet';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar') || mime.includes('gzip')) return 'archive';
    return 'other';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      if ((uploadMode === 'file' || uploadMode === 'audio') && selectedFile) {
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('sensitivityLevel', form.sensitivityLevel);
        formData.append('file', selectedFile);
        const res = await storeFile(formData);
        setResult(res.data);
        setForm({ title: '', data: '', sensitivityLevel: 'LOW' });
        setSelectedFile(null);
        setAudioUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const res = await storeData(form);
        setResult(res.data);
        setForm({ title: '', data: '', sensitivityLevel: 'LOW' });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to store data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fileCategory = selectedFile ? getFileCategory(selectedFile) : null;

  return (
    <div className="page">
      <h1>🔒 Store Data Securely</h1>
      <p className="subtitle">
        The system automatically selects encryption strength based on your role ({user.role}),
        location ({user.location}), time, device, and data sensitivity.
      </p>

      <div className="upload-mode-toggle">
        <button className={`btn ${uploadMode === 'text' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUploadMode('text')}>
          📝 Text Data
        </button>
        <button className={`btn ${uploadMode === 'file' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUploadMode('file')}>
          📎 Upload File
        </button>
        <button className={`btn ${uploadMode === 'audio' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUploadMode('audio')}>
          🎙️ Audio Recording
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleSubmit} className="store-form">
        <div className="form-group">
          <label>Title</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Name for this data entry" />
        </div>

        <div className="form-group">
          <label>Sensitivity Level</label>
          <select value={form.sensitivityLevel} onChange={(e) => setForm({ ...form, sensitivityLevel: e.target.value })}>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((level) => (
              <option key={level} value={level} disabled={!allowedLevels.includes(level)}>
                {level} {!allowedLevels.includes(level) ? '(Not allowed for your role)' : ''}
              </option>
            ))}
          </select>
        </div>

        {uploadMode === 'text' && (
          <div className="form-group">
            <label>Data to Encrypt</label>
            <textarea value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required placeholder="Enter the sensitive data you want to securely store..." rows={6} />
          </div>
        )}

        {uploadMode === 'file' && (
          <div className="form-group">
            <label>Upload File (Images, Audio, Video, Documents, Spreadsheets, Archives — up to 50MB)</label>
            <input type="file" ref={fileInputRef} accept={ALL_FORMATS} onChange={handleFileChange} required className="file-input" />
            {selectedFile && (
              <div className="selected-file">
                <span className="file-icon">{FILE_TYPE_ICONS[fileCategory] || '📎'}</span>
                <div>
                  <strong>{selectedFile.name}</strong>
                  <span className="file-meta">{(selectedFile.size / 1024).toFixed(1)} KB • {fileCategory?.toUpperCase()}</span>
                </div>
              </div>
            )}
            <div className="supported-formats">
              <small>Supported: {Object.entries(ACCEPTED_FORMATS).map(([cat, _]) => cat).join(', ')}</small>
            </div>
          </div>
        )}

        {uploadMode === 'audio' && (
          <div className="form-group">
            <label>Voice Interaction Input</label>
            <div className={`audio-recorder-panel ${isRecording ? 'recording-active' : ''}`}>
              <div className="recording-status">
                {isRecording ? '● Live Recording' : audioUrl ? 'Recording Complete' : 'Ready to record'}
              </div>
              <div className="recording-timer">
                {formatTime(recordingTime)}
              </div>
              
              {!audioUrl ? (
                <div 
                  className="recording-indicator" 
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? 'Stop Recording' : 'Start Recording'}
                >
                  {isRecording ? '⬜' : '🎤'}
                </div>
              ) : (
                <div className="audio-preview-container">
                  <audio src={audioUrl} controls className="audio-preview" />
                  <div className="recorder-controls" style={{ marginTop: '1rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={resetRecording}>
                      🗑️ Delete & Retry
                    </button>
                  </div>
                </div>
              )}
              
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
                {isRecording ? 'Click the icon to stop recording.' : !audioUrl ? 'Click the microphone to start recording your voice note.' : 'Review your recording above before encrypting.'}
              </p>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading || (uploadMode === 'audio' && !selectedFile) || (uploadMode === 'file' && !selectedFile)}>
          {loading ? '🔄 Encrypting & Storing...' : 
           uploadMode === 'file' ? '🔒 Encrypt File & Store' : 
           uploadMode === 'audio' ? '🔒 Encrypt Voice Note & Store' : 
           '🔒 Encrypt & Store'}
        </button>
      </form>

      {result && (
        <div className="result-card success">
          <h3>✅ Data Stored Successfully</h3>
          <div className="result-details">
            <div className="info-item"><strong>Title:</strong> {result.vaultItem.title}</div>
            {result.vaultItem.originalFileName && (
              <div className="info-item"><strong>File:</strong> {result.vaultItem.originalFileName}</div>
            )}
            <div className="info-item"><strong>Type:</strong> {FILE_TYPE_ICONS[result.vaultItem.fileType] || '📎'} {result.vaultItem.fileType?.toUpperCase()}</div>
            <div className="info-item">
              <strong>Sensitivity:</strong>{' '}
              <span className={`sensitivity-badge s-${result.vaultItem.sensitivityLevel.toLowerCase()}`}>{result.vaultItem.sensitivityLevel}</span>
            </div>
            <div className="info-item">
              <strong>Encryption:</strong>{' '}
              <span className={`strategy-badge strategy-${result.vaultItem.encryptionStrategy.toLowerCase()}`}>{result.vaultItem.encryptionStrategy}</span>
            </div>
            <div className="info-item"><strong>Algorithm:</strong> {result.vaultItem.algorithm}</div>
            {result.vaultItem.policyEvaluation && (
              <>
                <div className="info-item"><strong>Policy Score:</strong> {result.vaultItem.policyEvaluation.score}</div>
                <div className="info-item"><strong>Risk Level:</strong> {result.vaultItem.policyEvaluation.riskLevel}</div>
                {result.vaultItem.policyEvaluation.reasons && (
                  <div className="policy-reasons">
                    <strong>Policy Evaluation:</strong>
                    <ul>
                      {result.vaultItem.policyEvaluation.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
