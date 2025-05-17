import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

interface TeamProps {
  projectId: string | undefined;
}

const Team: React.FC<TeamProps> = ({ projectId }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Team Members
      </Typography>
      <Paper>
        <List>
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PersonIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary="John Doe"
              secondary="Project Manager"
            />
          </ListItem>
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PersonIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary="Jane Smith"
              secondary="Lead Developer"
            />
          </ListItem>
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PersonIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary="Mike Johnson"
              secondary="UI/UX Designer"
            />
          </ListItem>
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PersonIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary="Sarah Williams"
              secondary="Marketing Specialist"
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default Team; 