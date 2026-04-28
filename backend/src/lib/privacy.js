/**
 * Determines if a viewer can see the profile photo of an owner.
 * 
 * @param {string} viewerId - The ID of the person viewing the profile.
 * @param {object} owner - The user object whose profile is being viewed.
 * @returns {boolean}
 */
export function canSeeProfilePhoto(viewerId, owner) {
  if (!owner || !owner.privacy) return true; // Default to visible if no privacy settings

  const { profilePhotoVisibility, allowedUsers } = owner.privacy;

  // 1. Everyone
  if (profilePhotoVisibility === "everyone") return true;

  // 2. Nobody
  if (profilePhotoVisibility === "nobody") return false;

  // 3. Custom
  if (profilePhotoVisibility === "custom") {
    if (!allowedUsers || !Array.isArray(allowedUsers)) return false;
    return allowedUsers.some(id => id.toString() === viewerId.toString());
  }

  return false;
}

/**
 * Filters user data to hide profile photo if the viewer doesn't have access.
 * 
 * @param {string} viewerId - The ID of the logged-in user.
 * @param {object} user - The user object to filter.
 * @returns {object} - The filtered user object.
 */
export function filterUserPrivacy(viewerId, user) {
  if (!user) return null;
  
  // If user is a Mongoose document, convert to object
  const userObj = user.toObject ? user.toObject() : { ...user };
  
  // A user can always see their own photo
  if (viewerId.toString() === userObj._id.toString()) return userObj;

  if (!canSeeProfilePhoto(viewerId, userObj)) {
    userObj.profilePic = ""; // Or null/default
  }

  return userObj;
}
