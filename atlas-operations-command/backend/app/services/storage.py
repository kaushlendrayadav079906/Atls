import os
from abc import ABC, abstractmethod

class StorageService(ABC):
    @abstractmethod
    def save_file(self, filename: str, content: bytes) -> str:
        """Saves a file and returns its storage path/key"""
        pass

    @abstractmethod
    def get_file_path(self, stored_filename: str) -> str:
        """Returns the local path or URL for the stored file"""
        pass
        
    @abstractmethod
    def delete_file(self, stored_filename: str) -> bool:
        """Deletes a file"""
        pass

class LocalStorageService(StorageService):
    def __init__(self, upload_dir: str = "uploads"):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)
        
    def save_file(self, filename: str, content: bytes) -> str:
        file_path = os.path.join(self.upload_dir, filename)
        
        # Prevent path traversal
        normalized_base = os.path.normpath(self.upload_dir)
        normalized_path = os.path.normpath(file_path)
        if not normalized_path.startswith(normalized_base):
            raise ValueError("Invalid file path")
            
        with open(normalized_path, 'wb') as out_file:
            out_file.write(content)
            
        return filename

    def get_file_path(self, stored_filename: str) -> str:
        file_path = os.path.join(self.upload_dir, stored_filename)
        normalized_base = os.path.normpath(self.upload_dir)
        normalized_path = os.path.normpath(file_path)
        if not normalized_path.startswith(normalized_base):
            raise ValueError("Invalid file path")
        return normalized_path
        
    def delete_file(self, stored_filename: str) -> bool:
        file_path = self.get_file_path(stored_filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False

# Default instance
storage_service = LocalStorageService()
