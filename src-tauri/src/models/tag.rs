pub struct PresetTag {
    pub name: &'static str,
    pub category: &'static str,
    pub color: &'static str,
}

impl PresetTag {
    pub const fn new(name: &'static str, category: &'static str, color: &'static str) -> Self {
        Self {
            name,
            category,
            color,
        }
    }
}
