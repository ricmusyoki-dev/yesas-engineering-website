from django.core.files.uploadhandler import FileUploadHandler, StopUpload


class MediaUploadLimitHandler(FileUploadHandler):
    def __init__(self, request, max_file_size):
        super().__init__(request)
        self.max_file_size = max_file_size
        self.file_count = 0

    def new_file(self, *args, **kwargs):
        self.file_count += 1
        if self.file_count > 1:
            self.request.media_upload_rejected = "Only one file may be uploaded."
            raise StopUpload(connection_reset=False)
        self.file_size = 0
        super().new_file(*args, **kwargs)

    def receive_data_chunk(self, raw_data, start):
        self.file_size += len(raw_data)
        if self.file_size > self.max_file_size:
            self.request.media_upload_rejected = "The upload exceeds the size limit."
            raise StopUpload(connection_reset=False)
        return raw_data

    def file_complete(self, file_size):
        return None
