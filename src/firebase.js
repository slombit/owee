import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey:            "AIzaSyBBV82m45n2rzxgBVC2r8NzUbYXxxO9T6s",
  authDomain:        "owee-496c4.firebaseapp.com",
  databaseURL:       "https://owee-496c4-default-rtdb.firebaseio.com",
  projectId:         "owee-496c4",
  storageBucket:     "owee-496c4.firebasestorage.app",
  messagingSenderId: "80254171699",
  appId:             "1:80254171699:web:630b61d06249c555428146"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)