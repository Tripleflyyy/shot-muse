use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

pub struct StoredMediaFile {
    pub file_path: String,
    pub original_filename: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
}

pub fn copy_local_image(
    app_data_dir: &Path,
    source_path: &Path,
    target_type: &str,
    target_id: &str,
) -> Result<StoredMediaFile, String> {
    if !source_path.exists() {
        return Err("源图片文件不存在".to_string());
    }

    if !source_path.is_file() {
        return Err("请选择一个图片文件".to_string());
    }

    let extension =
        supported_image_extension(source_path).ok_or_else(|| "暂不支持该图片格式".to_string())?;
    let target_dir = media_target_dir(app_data_dir, target_type, target_id);
    fs::create_dir_all(&target_dir).map_err(|error| format!("创建图片目录失败：{error}"))?;

    let target_path = unique_target_path(&target_dir, extension);
    fs::copy(source_path, &target_path).map_err(|error| format!("复制图片失败：{error}"))?;

    let metadata =
        fs::metadata(&target_path).map_err(|error| format!("读取图片信息失败：{error}"))?;

    Ok(StoredMediaFile {
        file_path: target_path.to_string_lossy().into_owned(),
        original_filename: source_path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned()),
        mime_type: mime_type_for_extension(extension).map(ToOwned::to_owned),
        file_size: Some(metadata.len() as i64),
    })
}

pub fn validate_supported_image_path(source_path: &Path) -> Result<(), String> {
    supported_image_extension(source_path)
        .map(|_| ())
        .ok_or_else(|| "暂不支持该图片格式".to_string())
}

fn media_target_dir(app_data_dir: &Path, target_type: &str, target_id: &str) -> PathBuf {
    app_data_dir.join("media").join(target_type).join(target_id)
}

fn unique_target_path(target_dir: &Path, extension: &str) -> PathBuf {
    target_dir.join(format!("{}.{}", Uuid::new_v4(), extension))
}

fn supported_image_extension(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_string_lossy().to_lowercase();
    match extension.as_str() {
        "jpg" => Some("jpg"),
        "jpeg" => Some("jpg"),
        "png" => Some("png"),
        "webp" => Some("webp"),
        _ => None,
    }
}

fn mime_type_for_extension(extension: &str) -> Option<&'static str> {
    match extension {
        "jpg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_supported_image_extensions() {
        assert!(validate_supported_image_path(Path::new("/tmp/test.jpg")).is_ok());
        assert!(validate_supported_image_path(Path::new("/tmp/test.jpeg")).is_ok());
        assert!(validate_supported_image_path(Path::new("/tmp/test.png")).is_ok());
        assert!(validate_supported_image_path(Path::new("/tmp/test.webp")).is_ok());
        assert!(validate_supported_image_path(Path::new("/tmp/test.gif")).is_err());
    }
}
