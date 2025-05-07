export const authenticate = async (req, res, next) => {
    try{
        console.log("req.headers",req.headers)
        const token = req.headers['authorization'].split(' ')[1];
        if (!token){
            return res.status(401).json({ 
                status: false, 
                message: 'Unauthorized request', 
                data: null 
            });
        } 
    
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        console.log("decode",decoded);
        const user = await User.findOne({email:decoded.email})
        if (!user || user.isLoggedOut) {
            return res.status(401).json({ 
                status: false, 
                message: 'Access denied: Please log in again to continue', 
                data: null 
            });
        }
        // Check if the token's deviceId matches the stored currentDeviceId
        if (!user || !user.currentDeviceId.includes(decoded.deviceId)) {
            return res.status(401).json({
                status: false,
                message: 'Access denied: Session is not valid for this device',
                data: null
            });
        }
        req.user = decoded;
        next();

    }catch(error){
        logger.error(error);
        return res.status(403).json({ 
            status: false, 
            message: 'Forbidden: Invalid token', 
            data: null 
        });
    }
}

// Middleware to authorize based on roles
export const authorizeRoles = (roles) => (req, res, next) => {
    try{
        const isSuperAdmin = roles.includes(req.user.roles.type);
        if (!isSuperAdmin) {
            return res.status(403).json({ 
                status: false, 
                message: `Permission denied for ${req.user.roles.type}`, 
                data: null 
            });
        }
        next();
    }catch(error){
        logger.error(error);
        return res.status(500).json({ 
            status: false, 
            message: error.message, 
            data: null 
        });
    }
};




 