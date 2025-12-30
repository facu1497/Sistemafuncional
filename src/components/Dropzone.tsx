import { useRef, useState } from 'react';
import styles from './Dropzone.module.css';
import { UploadCloud } from 'lucide-react';

interface DropzoneProps {
    onFileSelect: (files: File[]) => void;
    label?: string;
    subLabel?: string;
    accept?: string;
    multiple?: boolean;
}

export const Dropzone = ({ onFileSelect, label = "Arrastrá tus archivos acá", subLabel = "o hacé click para seleccionar", accept, multiple = false }: DropzoneProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragActive, setIsDragActive] = useState(false);

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList) return;
        const files: File[] = [];
        for (let i = 0; i < fileList.length; i++) {
            files.push(fileList[i]);
        }
        if (files.length > 0) {
            onFileSelect(files);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
    };

    return (
        <div
            className={`${styles.dropzone} ${isDragActive ? styles.active : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
            <UploadCloud className={styles.icon} />
            <div>
                <div className={styles.text}>{label}</div>
                <div className={styles.subtext}>{subLabel}</div>
            </div>
            <input
                type="file"
                ref={inputRef}
                className={styles.fileInput}
                onChange={handleChange}
                accept={accept}
                multiple={multiple}
            />
        </div>
    );
};
